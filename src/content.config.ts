import { defineCollection } from 'astro:content';

const teams = defineCollection({});
const news = defineCollection({});

export const collections = { teams, news };
