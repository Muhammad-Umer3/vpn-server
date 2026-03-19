import { pool } from '../db/pool';

export interface ServerInfo {
  id: string;
  name: string;
  region: string;
  host: string;
  port: number;
  endpoint: string;
}

export async function getActiveServers(): Promise<ServerInfo[]> {
  const result = await pool.query(
    'SELECT id, name, region, host, port, endpoint FROM servers WHERE is_active = true ORDER BY region'
  );
  return result.rows;
}
