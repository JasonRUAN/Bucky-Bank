import buckyBankContract from "../../bucky-bank-contract.json";

export enum QueryKey {
    GetFileQueryKey = "GetFileQueryKey",
    GetBuckyBanks = "GetBuckyBanks",
    GetBuckyBankById = "GetBuckyBankById",
    GetDepositsByBuckyBankId = "GetDepositsByBuckyBankId",
    GetWithdrawsByBuckyBankId = "GetWithdrawsByBuckyBankId",
    GetWithdrawalRequestsByBuckyBankId = "GetWithdrawalRequestsByBuckyBankId",
    GetWithdrawalRequestsByRequester = "GetWithdrawalRequestsByRequester",
    GetParentPendingRequests = "GetParentPendingRequests",
}

export const CLOCK_OBJECT_ID = "0x6";
export const SUI_COIN_TYPE =
    "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";

export const CONSTANTS = {
    BUCKY_BANK_CONTRACT: {
        TARGET_CREATE_BUCKY_BANK: `${buckyBankContract.packageId}::bucky_bank::create_bucky_bank`,
        PACKAGE_ID: buckyBankContract.packageId,
        GLOBAL_STATS_SHARED_OBJECT_ID:
            buckyBankContract.globalStatsSharedObjectId,
    },
    TYPE: {
        USDC_COIN_TYPE:
            "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
        SUSDB_LP_TYPE:
            "0x38f61c75fa8407140294c84167dd57684580b55c3066883b48dedc344b1cde1e::susdb::SUSDB",
    },
    API: {
        BASE_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
    },
};
