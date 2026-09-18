using FluentMigrator;

namespace AgentFleetBoard.Migrations.Migrations;

/// <summary>
/// Project.RepoId was a required "the project's repo" field from before AssignProjectAsync was
/// loosened to a grouping label - agents keep their own repo, so a project spanning agents on
/// different repos (the normal case) had a required field that could only ever describe one of
/// them, which the UI then confusingly displayed as if it were authoritative. Makes it optional:
/// still useful as a default repo for a brand new agent with none yet, no longer pretends to be
/// "the" repo for the whole project.
/// </summary>
[Migration(202609180004)]
public sealed class M202609180004_MakeProjectRepoOptional : FluentMigrator.Migration
{
    public override void Up()
    {
        Execute.Sql("""ALTER TABLE "projects" ALTER COLUMN "repo_id" DROP NOT NULL;""");
        Execute.Sql("""ALTER TABLE "projects" DROP CONSTRAINT "projects_repo_id_fkey";""");
        Execute.Sql("""
            ALTER TABLE "projects" ADD CONSTRAINT "projects_repo_id_fkey"
                FOREIGN KEY ("repo_id") REFERENCES "repos" ("id") ON DELETE SET NULL;
            """);
    }

    public override void Down()
    {
        Execute.Sql("""ALTER TABLE "projects" DROP CONSTRAINT "projects_repo_id_fkey";""");
        Execute.Sql("""
            ALTER TABLE "projects" ADD CONSTRAINT "projects_repo_id_fkey"
                FOREIGN KEY ("repo_id") REFERENCES "repos" ("id") ON DELETE CASCADE;
            """);
        Execute.Sql("""ALTER TABLE "projects" ALTER COLUMN "repo_id" SET NOT NULL;""");
    }
}
