import { TemplateDefinition } from "./types";
import { modernChurchTemplate } from "./modern-church";
import { editorialChurchTemplate } from "./editorial-church";
import { minimalChurchTemplate } from "./minimal-church";
import {
  communityWarmTemplate,
  contemporaryBoldTemplate,
  sacredClassicTemplate,
} from "./extra-church";

export const templateRegistry: Record<string, TemplateDefinition> = {
  [modernChurchTemplate.id]: modernChurchTemplate,
  [editorialChurchTemplate.id]: editorialChurchTemplate,
  [minimalChurchTemplate.id]: minimalChurchTemplate,
  [communityWarmTemplate.id]: communityWarmTemplate,
  [contemporaryBoldTemplate.id]: contemporaryBoldTemplate,
  [sacredClassicTemplate.id]: sacredClassicTemplate,
};

export const allTemplates = Object.values(templateRegistry);

export function getTemplate(id: string): TemplateDefinition | undefined {
  return templateRegistry[id];
}
