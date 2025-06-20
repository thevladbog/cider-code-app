/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ShiftDto = {
    status: 'PLANNED' | 'INPROGRESS' | 'PAUSED' | 'DONE' | 'CANCELED';
    id: string;
    plannedDate: any;
    productId: string;
    plannedCount: number | null;
    factCount: number | null;
    packing: boolean;
    countInBox: number | null;
    operatorId: string | null;
    created: any;
    modified: any;
};

