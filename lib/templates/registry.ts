import { TemplateDefinition } from "./types";
import { modernChurchTemplate } from "./modern-church";
import { editorialChurchTemplate } from "./editorial-church";
import { minimalChurchTemplate } from "./minimal-church";
import {
  communityWarmTemplate,
  contemporaryBoldTemplate,
  sacredClassicTemplate,
} from "./extra-church";
import {
  emberSanctuaryTemplate,
  riverGatheringTemplate,
  nightCathedralTemplate,
} from "./cinematic-church";

export const templateRegistry: Record<string, TemplateDefinition> = {
  [modernChurchTemplate.id]: modernChurchTemplate,
  [editorialChurchTemplate.id]: editorialChurchTemplate,
  [minimalChurchTemplate.id]: minimalChurchTemplate,
  [communityWarmTemplate.id]: communityWarmTemplate,
  [contemporaryBoldTemplate.id]: contemporaryBoldTemplate,
  [sacredClassicTemplate.id]: sacredClassicTemplate,
  [emberSanctuaryTemplate.id]: emberSanctuaryTemplate,
  [riverGatheringTemplate.id]: riverGatheringTemplate,
  [nightCathedralTemplate.id]: nightCathedralTemplate,
};

export const allTemplates = Object.values(templateRegistry);

export function getTemplate(id: string): TemplateDefinition | undefined {
  return templateRegistry[id];
}
