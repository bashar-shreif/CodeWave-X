import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { Channels } from "./state";
import { ingestRepoNode } from "../nodes/ingestRepo.node";


export const compileReadmeGraph = () => {
  const g = new StateGraph(Channels);

  g.addNode("IngestRepo", ingestRepoNode);

  return g.compile();
};
