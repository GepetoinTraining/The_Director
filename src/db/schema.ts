import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// THE PROJECT (The Session)
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(), // We'll use UUIDs or simple string IDs
  name: text('name').default('Untitled Project'),
  status: text('status').default('development'), // 'development' | 'production'
  currentManifest: text('manifest_json'), // Stores the JSON plan
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

// THE EVENTS (The Unified Log)
// This replaces your chat messages AND your console logs
export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: text('project_id').references(() => projects.id),
  
  // WHO: 'user', 'director', 'producer', 'expert', 'system'
  source: text('source').notNull(), 
  
  // WHAT: 'chat' (text), 'log' (system update), 'action' (tool call)
  type: text('type').default('chat'), 
  
  // PAYLOAD
  content: text('content'),
  metadata: text('metadata_json'), // Store tool results/params here
  
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});