import { db } from "@/db";
import { messages, contacts } from "@/db/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";

export async function getUnansweredEmails(opts: { days?: number; onlyPriority?: boolean }) {
  const days = opts.days || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const results = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.direction, "inbound"),
        eq(messages.status, "nuevo"),
        gte(messages.receivedAt, since)
      )
    )
    .orderBy(desc(messages.receivedAt));

  return results.slice(0, 10);
}

export async function upsertContact(data: {
  email: string;
  name: string;
  org?: string;
  isPriority?: boolean;
}) {
  return await db
    .insert(contacts)
    .values({
      email: data.email,
      name: data.name,
      organization: data.org,
      isPriority: data.isPriority ? 1 : 0,
      lastInteractionAt: new Date(),
    })
    .onConflictDoUpdate({
      target: contacts.email,
      set: {
        lastInteractionAt: new Date(),
        isPriority: data.isPriority ? 1 : 0,
      },
    });
}

export async function getPriorityAlerts() {
  const priorityContacts = await db
    .select()
    .from(contacts)
    .where(eq(contacts.isPriority, 1));

  const emails = priorityContacts.map((c) => c.email);
  if (emails.length === 0) return [];

  return await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.status, "nuevo"),
        sql`${messages.fromName} ILIKE ANY (ARRAY[${sql.join(emails.map((e) => `%${e}%`), sql`, `)}])`
      )
    );
}