using AgentFleetBoard.Domain;
using Microsoft.EntityFrameworkCore;

namespace AgentFleetBoard.Persistence;

public sealed class AgentFleetBoardDbContext(DbContextOptions<AgentFleetBoardDbContext> options) : DbContext(options)
{
    public DbSet<RepoDefinition> Repos => Set<RepoDefinition>();

    public DbSet<AgentDefinition> Agents => Set<AgentDefinition>();

    public DbSet<AgentSession> Sessions => Set<AgentSession>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<RepoDefinition>(repo =>
        {
            repo.ToTable("repos");
            repo.HasKey(r => r.Id);
        });

        modelBuilder.Entity<AgentDefinition>(agent =>
        {
            agent.ToTable("agents");
            agent.HasKey(a => a.Id);
            agent.HasOne<RepoDefinition>()
                .WithMany()
                .HasForeignKey(a => a.AssignedRepoId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<AgentSession>(session =>
        {
            session.ToTable("agent_sessions");
            session.HasKey(s => s.Id);
            session.Property(s => s.Status).HasConversion<string>();
            session.HasOne<AgentDefinition>()
                .WithMany()
                .HasForeignKey(s => s.AgentId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
