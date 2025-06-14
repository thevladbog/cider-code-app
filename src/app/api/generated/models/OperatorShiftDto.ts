/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type OperatorShiftDto = {
  status: 'PLANNED' | 'INPROGRESS' | 'PAUSED' | 'DONE' | 'CANCELED';
  id: string;
  plannedDate: any;
  product: {
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
  plannedCount: number | null;
  factCount: number | null;
  packing: boolean;
  countInBox: number | null;
  operatorId: string | null;
  created: any;
  modified: any;
};
