export interface ISolutionPayload {
	code: string;
	thoughts: string[];
	time_complexity: string;
	space_complexity: string;
}

export interface IDebugPayload {
	code: string;
	debug_analysis: string;
	thoughts: string[];
	time_complexity: string;
	space_complexity: string;
}

export type { UpdateDownloadedEvent, UpdateInfo } from "electron-updater";
export type { IProblemStatementData } from "./solutions";
