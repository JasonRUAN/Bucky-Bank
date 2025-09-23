import buckyBankContract from "../../bucky-bank-contract.json";

export enum QueryKey {
    GetFileQueryKey = "GetFileQueryKey",
    GetBuckyBanks = "GetBuckyBanks",
    GetBuckyBankById = "GetBuckyBankById",
}

export const CLOCK_OBJECT_ID = "0x6";
export const SUI_COIN_TYPE = "0x2::sui::SUI";

export const CONSTANTS = {
    BUCKY_BANK_CONTRACT: {
        TARGET_CREATE_BUCKY_BANK: `${buckyBankContract.packageId}::bucky_bank::create_bucky_bank`,
        PACKAGE_ID: buckyBankContract.packageId,
    },
    API: {
        BASE_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
    },
};
