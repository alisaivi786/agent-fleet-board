using FluentMigrator.Runner;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

string connectionString = Environment.GetEnvironmentVariable("AGENTFLEETBOARD_MIGRATION_CONNECTION")
    ?? throw new InvalidOperationException("Set AGENTFLEETBOARD_MIGRATION_CONNECTION to a Postgres connection string.");

using ServiceProvider serviceProvider = new ServiceCollection()
    .AddFluentMigratorCore()
    .ConfigureRunner(rb => rb
        .AddPostgres()
        .WithGlobalConnectionString(connectionString)
        .ScanIn(typeof(Program).Assembly).For.Migrations())
    .AddLogging(lb => lb.AddFluentMigratorConsole())
    .BuildServiceProvider(validateScopes: false);

using IServiceScope scope = serviceProvider.CreateScope();
IMigrationRunner runner = scope.ServiceProvider.GetRequiredService<IMigrationRunner>();

if (args.Contains("down", StringComparer.OrdinalIgnoreCase))
{
    runner.MigrateDown(0);
}
else
{
    runner.MigrateUp();
}
