import type { IncomingMessage, ServerResponse } from 'node:http';

export const DATA_DIR: string;
export const DB_FILE: string;
export function dbApi(req: IncomingMessage, res: ServerResponse, next?: () => void): Promise<void>;
