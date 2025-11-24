// src/lib/storage.ts
import { db } from '../db';
import { projects, events } from '../db/schema';
import { eq, asc } from 'drizzle-orm';

// --- PROJECT MANAGEMENT ---

export async function getOrCreateProject(id: string = 'default') {
  const existing = db.select().from(projects).where(eq(projects.id, id)).get();
  if (existing) return existing;

  const newProject = { id, name: 'New Session', status: 'development' };
  db.insert(projects).values(newProject).run();
  return newProject;
}

export async function updateProjectStatus(id: string, status: string, manifest?: any) {
  db.update(projects)
    .set({ 
      status, 
      currentManifest: manifest ? JSON.stringify(manifest) : undefined 
    })
    .where(eq(projects.id, id))
    .run();
}

// --- EVENT LOGGING (The Heartbeat) ---

export async function logEvent(projectId: string, event: {
  source: 'USER' | 'DIRECTOR' | 'PRODUCER' | 'EXPERT' | 'SYSTEM',
  type: 'chat' | 'log' | 'error' | 'command',
  content: string,
  metadata?: any
}) {
  db.insert(events).values({
    projectId,
    source: event.source,
    type: event.type,
    content: event.content,
    metadata: event.metadata ? JSON.stringify(event.metadata) : null
  }).run();
}

// --- RETRIEVAL (For Context) ---

export async function getProjectHistory(projectId: string) {
  const rows = db.select()
    .from(events)
    .where(eq(events.projectId, projectId))
    .orderBy(asc(events.createdAt))
    .all();

  // Map back to UI/AI format
  return rows.map(row => ({
    id: row.id.toString(),
    role: mapSourceToRole(row.source),
    content: row.content,
    source: row.source, // Keep original source for UI
    type: row.type,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.createdAt
  }));
}

// --- MAINTENANCE ---

export async function clearProjectHistory(projectId: string) {
  db.delete(events).where(eq(events.projectId, projectId)).run();
}

function mapSourceToRole(source: string) {
  if (source === 'USER') return 'user';
  if (source === 'DIRECTOR' || source === 'EXPERT') return 'assistant';
  return 'system';
}