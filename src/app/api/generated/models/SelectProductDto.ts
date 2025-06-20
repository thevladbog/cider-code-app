/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SelectProductDto = {
    status: 'ACTIVE' | 'INACTIVE' | 'PAUSED' | 'REGISTRATION' | 'ARCHIVED';
    /**
     * The unique identifier for the product
     */
    id: string;
    shortName: string;
    fullName: string;
    gtin: string;
    alcoholCode: string;
    expirationInDays: number;
    volume: any;
    pictureUrl: string | null;
    created: any;
    modified: any;
};

