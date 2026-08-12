import { SectionType } from "@/lib/site/types";

export interface TemplateSectionSpec {
  type: SectionType;
  variant: string;
  config?: Record<string, unknown>;
}

export interface TemplateDefinition {
  id: string;
  version: number;
  metadata: {
    name: string;
    description: string;
    style: string;
    suitableFor: string[];
  };
  sections: TemplateSectionSpec[];
}
