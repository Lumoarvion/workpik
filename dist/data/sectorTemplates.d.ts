export interface CustomFieldTemplate {
    label: string;
    type: 'text' | 'number' | 'textarea' | 'checkbox' | 'select' | 'checklist';
    required: boolean;
    options?: string[];
}
export interface PhotoStepTemplate {
    id: string;
    label: string;
    description?: string;
    required: boolean;
    sortOrder: number;
}
export interface WorkTypeTemplate {
    name: string;
    icon: string;
    suggestedFields: CustomFieldTemplate[];
    photoSteps?: PhotoStepTemplate[];
}
export interface IndustryTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    enabledModules: string[];
    workTypes: WorkTypeTemplate[];
}
export declare const ALL_MODULES: {
    id: string;
    label: string;
    description: string;
    core: boolean;
}[];
export declare const industryTemplates: IndustryTemplate[];
export type SectorTemplate = IndustryTemplate;
export declare const sectorTemplates: IndustryTemplate[];
//# sourceMappingURL=sectorTemplates.d.ts.map