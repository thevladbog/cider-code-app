/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateOrderToDeliveryDto = {
  id?: string;
  orderNumber: string;
  deliveryDate: any;
  status?: 'NEW' | 'ARCHIVE';
  consignee: string;
  address: string;
  created?: any;
  modified?: any;
};
