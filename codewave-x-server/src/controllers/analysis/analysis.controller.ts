import { Controller, Get, HttpStatus, Param, Query, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { RunToolsService } from '../../services/run-tools/run-tools.service';
import { DepsRunResponseDto } from '../../dto/runtime/deps-run.dto';
import { StatsResponseDto } from 'src/dto/analysis/stats.dto/stats.dto';
import { GetFilesResponseDto } from 'src/dto/analysis/files-response.dto/files-response.dto';
import {
  GetStacksResponseDto,
  StacksResultDto,
} from 'src/dto/analysis/stacks-response.dto/stacks-response.dto';
import { ProjectParamDto } from 'src/dto/common/project-param/project-param.dto';
import {
  GetLanguagesResponseDto,
  LanguagesResultDto,
} from 'src/dto/analysis/languages-response.dto/languages-response.dto';
import { ArchitectureResponseDto } from 'src/dto/analysis/architecture-response.dto/architecture-response.dto';
import path from 'path';
import * as fs from 'fs';
import { CiResponseDto } from 'src/dto/analysis/ci-response.dto/ci-response.dto';
import { ConfigResponseDto } from 'src/dto/analysis/config-response.dto/config-response.dto';
import { DocsResponseDto } from 'src/dto/analysis/docs-response.dto/docs-response.dto';
import { RoutesResponseDto } from 'src/dto/analysis/routes-response.dto/routes-response.dto';
import { TestsResponseDto } from 'src/dto/analysis/tests-response.dto/tests-response.dto';
import { ReadmeNoLlmResponseDto } from 'src/dto/readme/readme-deterministic.dto/readme-deterministic.dto';

@ApiTags('analysis')
@Controller('/v1/projects/:projectId')
export class AnalysisController {
  constructor(private readonly run: RunToolsService) {}

  @Get('deps')
  @ApiOperation({ summary: 'Run dependency analysis tool' })
  @ApiParam({ name: 'projectId', required: true })
  @ApiOkResponse({ type: DepsRunResponseDto })
  async getDeps(
    @Param('projectId') projectId: string,
  ): Promise<DepsRunResponseDto> {
    return this.run.runDeps(projectId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get repository stats' })
  @ApiParam({ name: 'projectId', required: true })
  @ApiQuery({ name: 'force', required: false, type: Boolean })
  @ApiOkResponse({
    type: StatsResponseDto,
    schema: {
      example: {
        projectId: 'job_001',
        status: 'ok',
        tookMs: 12,
        result: {
          totalFiles: 128,
          totalBytes: 345678,
          languages: {
            byLanguage: { typescript: 60, json: 20, md: 10, other: 10 },
          },
          manifests: 3,
          isMonorepo: true,
        },
      },
    },
  })
  async stats(
    @Param('projectId') projectId: string,
    @Query('force') force?: string,
  ): Promise<StatsResponseDto> {
    const t0 = Date.now();
    const out = await this.run.runStats({ projectId, force: force === 'true' });
    return { projectId, status: 'ok', tookMs: Date.now() - t0, result: out };
  }

  @Get('files')
  @ApiOperation({ summary: 'List files with size and hash' })
  @ApiParam({ name: 'projectId', required: true })
  @ApiOkResponse({
    schema: {
      allOf: [{ $ref: getSchemaPath(GetFilesResponseDto) }],
    },
    examples: {
      sample: {
        summary: 'ok',
        value: {
          projectId: 'job_001',
          status: 'ok',
          tookMs: 12,
          result: {
            totalFiles: 3,
            totalBytes: 12345,
            files: [
              { path: 'app/package.json', size: 512, hash: 'abc...' },
              { path: 'server/composer.json', size: 2048, hash: 'def...' },
            ],
            isMonorepo: false,
          },
        },
      },
    },
  })
  async getFiles(
    @Param('projectId') projectId: string,
  ): Promise<GetFilesResponseDto> {
    const t0 = Date.now();
    const result = await this.run.runFiles({ projectId });
    return {
      projectId,
      status: 'ok',
      tookMs: Date.now() - t0,
      result,
    };
  }

  @Get('stacks')
  @ApiOperation({ summary: 'Detect frameworks & platforms' })
  @ApiOkResponse({ type: GetStacksResponseDto })
  async getStacks(
    @Param() params: ProjectParamDto,
  ): Promise<GetStacksResponseDto> {
    const started = Date.now();
    const { projectId } = params;

    const data = await this.run.runStacks({ projectId });

    const result: StacksResultDto = {
      isMonorepo: data.isMonorepo,
      aggregated: data.aggregated,
      perSubproject: data.perSubproject?.map((p) => ({
        name: p.name,
        stacks: p.stacks,
        raw: p.raw,
      })),
    };

    return {
      projectId,
      status: 'ok',
      tookMs: Date.now() - started,
      result,
    };
  }

  @Get('languages')
  @ApiOperation({ summary: 'Get language distribution' })
  @ApiOkResponse({ type: GetLanguagesResponseDto })
  async getLanguages(
    @Param('projectId') pid: string,
  ): Promise<GetLanguagesResponseDto> {
    const t0 = Date.now();
    const res = await this.run.runLanguages({ projectId: pid });
    const tookMs = Date.now() - t0;

    const isMono = !!res && Array.isArray((res as any).perSubproject);
    if (isMono) {
      const per = (res as any).perSubproject.map((p: any) => ({
        name: p.name,
        distribution: p.distribution ?? {},
      }));
      return {
        projectId: pid,
        status: 'ok',
        tookMs,
        result: {
          isMonorepo: true,
          aggregated: (res as any).aggregated ?? {},
          perSubproject: per,
        },
      };
    }

    return {
      projectId: pid,
      status: 'ok',
      tookMs,
      result: {
        isMonorepo: false,
        aggregated: (res as any)?.aggregated ?? {},
      },
    };
  }

  @Get('architecture')
  @ApiOperation({
    summary: 'Summarize architecture per subproject and aggregate',
  })
  @ApiOkResponse({
    type: ArchitectureResponseDto,
    schema: {
      example: {
        projectId: 'job_001',
        status: 'ok',
        tookMs: 28,
        result: {
          isMonorepo: true,
          aggregated: {
            summaries: [
              'Modular NestJS backend with DI and modules',
              'React SPA with routing and API client',
            ],
            components: ['API', 'Auth', 'DB', 'UI', 'CLI'],
            patterns: ['Repository', 'Factory', 'Observer'],
          },
          perSubproject: [
            {
              name: 'api',
              summary: 'NestJS modular service exposing REST endpoints',
              components: ['API', 'Auth', 'DB'],
              patterns: ['Repository'],
            },
            {
              name: 'web',
              summary: 'React app with SPA routing',
              components: ['UI'],
              patterns: ['Observer'],
            },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async architecture(@Param('projectId') projectId: string, @Res() res) {
    const started = Date.now();
    const rootBase =
      process.env.READMEA_WORKSPACES_ROOT ||
      path.join(__dirname, '..', 'workspaces');
    const repoRoot = path.join(rootBase, projectId);
    if (!fs.existsSync(repoRoot)) {
      return res.status(HttpStatus.NOT_FOUND).json({
        projectId,
        status: 'error',
        tookMs: Date.now() - started,
        error: 'not_found',
        message: 'Workspace not found',
        details: { repoRoot },
      });
    }
    const result = await this.run.runArchitecture(repoRoot);
    return res.status(HttpStatus.OK).json({
      projectId,
      status: 'ok',
      tookMs: Date.now() - started,
      result,
    });
  }

  @Get('ci')
  @ApiOperation({ summary: 'Summarize CI providers and workflows' })
  @ApiOkResponse({
    type: CiResponseDto,
    schema: {
      example: {
        projectId: 'job_001',
        status: 'ok',
        tookMs: 22,
        result: {
          isMonorepo: true,
          aggregated: {
            providers: ['github-actions', 'gitlab-ci'],
            workflowsCount: 3,
          },
          perSubproject: [
            {
              name: 'time-capsule-server',
              providers: ['github-actions'],
              workflows: [
                {
                  name: 'ci',
                  path: '.github/workflows/ci.yml',
                  triggers: ['push', 'pull_request'],
                  jobs: ['build', 'test'],
                },
              ],
            },
            {
              name: 'time-capsule-client',
              providers: ['gitlab-ci'],
              workflows: [
                {
                  name: 'build',
                  path: '.gitlab-ci.yml',
                  triggers: ['push'],
                  jobs: ['build'],
                },
                {
                  name: 'deploy',
                  path: '.gitlab-ci.yml',
                  triggers: ['tag'],
                  jobs: ['deploy'],
                },
              ],
            },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async ci(@Param('projectId') projectId: string, @Res() res) {
    const started = Date.now();
    const rootBase =
      process.env.READMEA_WORKSPACES_ROOT ||
      path.join(__dirname, '..', 'workspaces');
    const repoRoot = path.join(rootBase, projectId);
    if (!fs.existsSync(repoRoot)) {
      return res.status(HttpStatus.NOT_FOUND).json({
        projectId,
        status: 'error',
        tookMs: Date.now() - started,
        error: 'not_found',
        message: 'Workspace not found',
        details: { repoRoot },
      });
    }
    const result = await this.run.runCI(repoRoot);
    return res
      .status(HttpStatus.OK)
      .json({ projectId, status: 'ok', tookMs: Date.now() - started, result });
  }

  @Get('config')
  @ApiOperation({ summary: 'Summarize build/config: bundlers, CSS tools, env' })
  @ApiOkResponse({
    type: ConfigResponseDto,
    schema: {
      example: {
        projectId: 'job_001',
        status: 'ok',
        tookMs: 27,
        result: {
          isMonorepo: true,
          aggregated: {
            bundlers: ['Vite', 'Webpack'],
            cssTools: ['PostCSS', 'Sass'],
            env: {
              files: ['.env', '.env.local'],
              variables: ['API_URL', 'NODE_ENV'],
            },
          },
          perSubproject: [
            {
              name: 'backend',
              bundlers: ['Laravel Mix'],
              cssTools: [],
              env: { files: ['.env'], variables: ['APP_ENV', 'DB_HOST'] },
            },
            {
              name: 'frontend',
              bundlers: ['Vite'],
              cssTools: ['PostCSS'],
              env: { files: ['.env.local'], variables: ['VITE_API_URL'] },
            },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async config(@Param('projectId') projectId: string, @Res() res) {
    const started = Date.now();
    const rootBase =
      process.env.READMEA_WORKSPACES_ROOT ||
      path.join(__dirname, '..', 'workspaces');
    const repoRoot = path.join(rootBase, projectId);
    if (!fs.existsSync(repoRoot)) {
      return res.status(HttpStatus.NOT_FOUND).json({
        projectId,
        status: 'error',
        tookMs: Date.now() - started,
        error: 'not_found',
        message: 'Workspace not found',
        details: { repoRoot },
      });
    }
    const result = await this.run.runConfig(repoRoot);
    return res
      .status(HttpStatus.OK)
      .json({ projectId, status: 'ok', tookMs: Date.now() - started, result });
  }

  @Get('docs')
  @ApiOperation({ summary: 'Summarize docs: readmes, docs tree, topics' })
  @ApiOkResponse({
    type: DocsResponseDto,
    schema: {
      example: {
        projectId: 'job_001',
        status: 'ok',
        tookMs: 24,
        result: {
          isMonorepo: true,
          aggregated: {
            readmes: ['README.md', 'backend/README.md'],
            topics: ['Setup', 'Deployment', 'API', 'Contributing'],
            docsCount: 5,
          },
          perSubproject: [
            {
              name: 'frontend',
              readmes: ['README.md'],
              docs: ['docs/intro.md', 'docs/deploy.md'],
              topics: ['Setup', 'Deployment'],
            },
            {
              name: 'backend',
              readmes: ['README.md'],
              docs: ['docs/api.md', 'docs/contributing.md', 'mkdocs.yml'],
              topics: ['API', 'Contributing'],
            },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async docs(@Param('projectId') projectId: string, @Res() res) {
    const started = Date.now();
    const rootBase =
      process.env.READMEA_WORKSPACES_ROOT ||
      path.join(__dirname, '..', 'workspaces');
    const repoRoot = path.join(rootBase, projectId);
    if (!fs.existsSync(repoRoot)) {
      return res.status(HttpStatus.NOT_FOUND).json({
        projectId,
        status: 'error',
        tookMs: Date.now() - started,
        error: 'not_found',
        message: 'Workspace not found',
        details: { repoRoot },
      });
    }
    const result = await this.run.runDocs(repoRoot);
    return res
      .status(HttpStatus.OK)
      .json({ projectId, status: 'ok', tookMs: Date.now() - started, result });
  }

  @Get('routes')
  @ApiOperation({ summary: 'Summarize web/API routes per subproject' })
  @ApiOkResponse({
    type: RoutesResponseDto,
    schema: {
      example: {
        projectId: 'job_001',
        status: 'ok',
        tookMs: 31,
        result: {
          isMonorepo: true,
          aggregated: {
            count: 6,
            httpMethods: ['GET', 'POST'],
            apiCount: 4,
            webCount: 2,
          },
          perSubproject: [
            {
              name: 'backend',
              totals: { count: 4, httpMethods: ['GET', 'POST'] },
              routes: [
                {
                  type: 'api',
                  method: 'GET',
                  path: '/api/v1/items',
                  source: 'src/items/items.controller.ts',
                },
                {
                  type: 'api',
                  method: 'POST',
                  path: '/api/v1/items',
                  source: 'src/items/items.controller.ts',
                },
              ],
            },
            {
              name: 'frontend',
              totals: { count: 2, httpMethods: ['GET'] },
              routes: [
                {
                  type: 'web',
                  method: 'GET',
                  path: '/',
                  source: 'src/routes/index.tsx',
                },
                {
                  type: 'web',
                  method: 'GET',
                  path: '/about',
                  source: 'src/routes/about.tsx',
                },
              ],
            },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async routes(@Param('projectId') projectId: string, @Res() res) {
    const started = Date.now();
    const rootBase =
      process.env.READMEA_WORKSPACES_ROOT ||
      path.join(__dirname, '..', 'workspaces');
    const repoRoot = path.join(rootBase, projectId);
    if (!fs.existsSync(repoRoot)) {
      return res.status(HttpStatus.NOT_FOUND).json({
        projectId,
        status: 'error',
        tookMs: Date.now() - started,
        error: 'not_found',
        message: 'Workspace not found',
        details: { repoRoot },
      });
    }
    const result = await this.run.runRoutes(repoRoot);
    return res
      .status(HttpStatus.OK)
      .json({ projectId, status: 'ok', tookMs: Date.now() - started, result });
  }

  @Get('tests')
  @ApiOperation({ summary: 'Summarize tests: frameworks, counts, locations' })
  @ApiOkResponse({
    type: TestsResponseDto,
    schema: {
      example: {
        projectId: 'job_001',
        status: 'ok',
        tookMs: 25,
        result: {
          isMonorepo: true,
          aggregated: { count: 3, frameworks: ['Jest'] },
          perSubproject: [
            {
              name: 'frontend',
              frameworks: ['Jest'],
              totals: { count: 3 },
              files: [
                'src/App.test.js',
                'src/components/Button.spec.tsx',
                '__tests__/utils.test.ts',
              ],
            },
            {
              name: 'backend',
              frameworks: [],
              totals: { count: 0 },
              files: [],
            },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async tests(@Param('projectId') projectId: string, @Res() res) {
    const started = Date.now();
    const rootBase =
      process.env.READMEA_WORKSPACES_ROOT ||
      path.join(__dirname, '..', 'workspaces');
    const repoRoot = path.join(rootBase, projectId);
    if (!fs.existsSync(repoRoot)) {
      return res.status(HttpStatus.NOT_FOUND).json({
        projectId,
        status: 'error',
        tookMs: Date.now() - started,
        error: 'not_found',
        message: 'Workspace not found',
        details: { repoRoot },
      });
    }
    const result = await this.run.runTests(repoRoot);
    return res
      .status(HttpStatus.OK)
      .json({ projectId, status: 'ok', tookMs: Date.now() - started, result });
  }

  @Get('readme/no-ai')
  @ApiOperation({ summary: 'Compose a README from tool outputs without LLMs' })
  @ApiOkResponse({
    type: ReadmeNoLlmResponseDto,
    schema: {
      example: {
        projectId: 'job_001',
        status: 'ok',
        tookMs: 120,
        result: {
          text: '# job_001\n\n![security](https://img.shields.io/badge/security-85-blue) ![structure](https://img.shields.io/badge/repo-monorepo-informational)\n\n## Overview\n- Modular backend service with REST API\n\n## Tech Stack\n- React\n- Laravel\n\n## Stats\n- Files: 1240\n- Size: 3456789 bytes\n- Languages: .ts: 800, .php: 300, .json: 50\n\n## Dependencies\n- Runtime: 45\n- Dev: 32\n- Tools: 6\n\n## Build & Config\n- Bundlers: Vite, Laravel Mix\n- CSS tools: Tailwind CSS, PostCSS\n\n## Environment\n- Files: .env, .env.local\n- Variables: API_URL, NODE_ENV, DB_HOST\n\n## CI\n- Providers: github-actions\n\n## Documentation\n- READMEs: README.md, backend/README.md\n- Docs files: 5\n\n## Routes\n- Total: 20 (GET, POST)\n\n## Tests\n- Frameworks: Jest, PHPUnit\n- Test files: 42',
          length: 650,
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async readmeNoLlm(@Param('projectId') projectId: string, @Res() res) {
    const started = Date.now();
    const rootBase =
      process.env.READMEA_WORKSPACES_ROOT ||
      path.join(__dirname, '..', 'workspaces');
    const repoRoot = path.join(rootBase, projectId);
    if (!fs.existsSync(repoRoot)) {
      return res.status(HttpStatus.NOT_FOUND).json({
        projectId,
        status: 'error',
        tookMs: Date.now() - started,
        error: 'not_found',
        message: 'Workspace not found',
        details: { repoRoot },
      });
    }
    const result = await this.run.runReadmeNoAi(repoRoot, projectId);
    return res
      .status(HttpStatus.OK)
      .json({ projectId, status: 'ok', tookMs: Date.now() - started, result });
  }
}
