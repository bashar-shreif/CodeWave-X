import { Controller, Post, Body, Query, Sse } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ReadmeOrchestratorService } from '../orchestrator/readmeOrchestrator.service';

type DraftDto = { repoRoot: string; force?: boolean; useLLM?: boolean };
type FinalDto = { repoRoot: string; force?: boolean; useLLM?: boolean };

@Controller('/v1/readme')
export class ReadmeController {
  constructor(private readonly svc: ReadmeOrchestratorService) {}

  @Post('draft')
  async draft(@Body() dto: DraftDto) {
    const { repoRoot, force, useLLM } = dto;
    return await this.svc.startDraft(repoRoot, !!force, useLLM);
  }

  @Post('final')
  async final(@Body() dto: FinalDto) {
    const { repoRoot, force, useLLM } = dto;
    return await this.svc.startFinal(repoRoot, !!force, useLLM);
  }

  @Sse('progress')
  progress(@Query('runId') runId: string): Observable<MessageEvent> {
    return this.svc.getProgress(runId).pipe(
      map((e: any) => {
        if (typeof e?.data === 'string') return e;
        return { data: JSON.stringify(e) } as any;
      }),
    );
  }
}
