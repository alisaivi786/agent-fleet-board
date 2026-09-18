using System.Runtime.InteropServices;
using System.Runtime.Versioning;

namespace AgentFleetBoard.Api.Services;

public sealed record SystemMetricsSnapshot(bool Supported, double? CpuPercent, double? MemoryUsedMb, double? MemoryTotalMb);

/// <summary>
/// Samples real host CPU/RAM usage on a timer via raw Win32 P/Invoke - no PerformanceCounter
/// package, no fabricated numbers (see CLAUDE.md: the mockup's "System Health" panel also showed
/// Queue Depth/Agent Heartbeat, which were dropped because nothing in this app produces that data;
/// CPU/RAM read straight from the OS is genuinely real, so that part stayed). Windows-only;
/// GetLatest() reports Supported = false elsewhere rather than throwing.
/// </summary>
public sealed class SystemMetricsSampler : BackgroundService
{
    private SystemMetricsSnapshot latest = new(OperatingSystem.IsWindows(), null, null, null);
    private (ulong Idle, ulong Kernel, ulong User)? previousTimes;

    public SystemMetricsSnapshot GetLatest() => latest;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!OperatingSystem.IsWindows())
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            Sample();
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    [SupportedOSPlatform("windows")]
    private void Sample()
    {
        double? cpuPercent = null;
        if (NativeMethods.GetSystemTimes(out FILETIME idleFt, out FILETIME kernelFt, out FILETIME userFt))
        {
            ulong idle = ToUlong(idleFt);
            ulong kernel = ToUlong(kernelFt);
            ulong user = ToUlong(userFt);

            if (previousTimes is { } prev)
            {
                ulong idleDelta = idle - prev.Idle;
                ulong totalDelta = (kernel - prev.Kernel) + (user - prev.User);
                if (totalDelta > 0)
                {
                    cpuPercent = Math.Clamp(100.0 * (1.0 - (double)idleDelta / totalDelta), 0, 100);
                }
            }

            previousTimes = (idle, kernel, user);
        }

        double? memoryUsedMb = null, memoryTotalMb = null;
        var memStatus = new MEMORYSTATUSEX { dwLength = (uint)Marshal.SizeOf<MEMORYSTATUSEX>() };
        if (NativeMethods.GlobalMemoryStatusEx(ref memStatus))
        {
            memoryTotalMb = memStatus.ullTotalPhys / 1024.0 / 1024.0;
            memoryUsedMb = memoryTotalMb - memStatus.ullAvailPhys / 1024.0 / 1024.0;
        }

        latest = new SystemMetricsSnapshot(true, cpuPercent ?? latest.CpuPercent, memoryUsedMb, memoryTotalMb);
    }

    private static ulong ToUlong(FILETIME ft) => ((ulong)ft.dwHighDateTime << 32) | ft.dwLowDateTime;
}

[StructLayout(LayoutKind.Sequential)]
internal struct FILETIME
{
    public uint dwLowDateTime;
    public uint dwHighDateTime;
}

[StructLayout(LayoutKind.Sequential)]
internal struct MEMORYSTATUSEX
{
    public uint dwLength;
    public uint dwMemoryLoad;
    public ulong ullTotalPhys;
    public ulong ullAvailPhys;
    public ulong ullTotalPageFile;
    public ulong ullAvailPageFile;
    public ulong ullTotalVirtual;
    public ulong ullAvailVirtual;
    public ulong ullAvailExtendedVirtual;
}

[SupportedOSPlatform("windows")]
internal static class NativeMethods
{
    [DllImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetSystemTimes(out FILETIME lpIdleTime, out FILETIME lpKernelTime, out FILETIME lpUserTime);

    [DllImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX lpBuffer);
}
