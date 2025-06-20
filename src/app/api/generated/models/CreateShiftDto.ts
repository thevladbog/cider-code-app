/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateShiftDto = {
    id?: string;
    plannedDate?: any;
    plannedCount: number | null;
    factCount: number | null;
    packing?: boolean;
    countInBox: number | null;
    status?: 'PLANNED' | 'INPROGRESS' | 'PAUSED' | 'DONE' | 'CANCELED';
    productId: string;
};

