using AgentFleetBoard.Api.Options;
using AgentFleetBoard.Api.Services;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

// Real agent repo paths are machine-specific and never committed - see appsettings.Local.json.example.
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

builder.Services.Configure<AgentFleetOptions>(builder.Configuration.GetSection(AgentFleetOptions.SectionName));
builder.Services.AddSingleton<IGitStatusReader, GitStatusReader>();

const string devClientCors = "DevClient";
builder.Services.AddCors(options => options.AddPolicy(devClientCors, policy =>
    policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
          .AllowAnyHeader()
          .AllowAnyMethod()));

var app = builder.Build();

app.UseCors(devClientCors);

app.MapGet("/api/agents", async (IOptions<AgentFleetOptions> options, IGitStatusReader reader, CancellationToken cancellationToken) =>
{
    AgentFleetOptions fleet = options.Value;
    var statuses = await Task.WhenAll(fleet.Agents.Select(agent => reader.ReadAsync(agent, cancellationToken)));
    return Results.Ok(statuses);
});

app.MapGet("/", () => Results.Redirect("/api/agents"));

app.Run();
