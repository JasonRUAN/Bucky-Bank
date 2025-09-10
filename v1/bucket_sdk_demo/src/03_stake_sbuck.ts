import dotenv from "dotenv";
dotenv.config();
import { BucketClient } from "bucket-protocol-sdk";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { getSigner } from "./utils/sui_utils";
const USER1_ADDR = process.env.USER1!;

const USDC_TYPE =
    "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
const BUCK_TYPE =
    "0xce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2::buck::BUCK";
const sBUCK_TYPE =
    "0x1798f84ee72176114ddbf5525a6d964c5f8ea1b3738d08d50d0d3de4cf584884::sbuck::SBUCK";

async function call() {
    const signer = getSigner(USER1_ADDR);
    const owner = await signer.toSuiAddress(); // Make sure to await the address

    const buck = new BucketClient();

    const tx = new Transaction();
    const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

    let coin = await client.getCoins({
        owner,
        coinType: sBUCK_TYPE,
    });

    console.log(JSON.stringify(coin, null, 2));

    // {
    //     "data": [
    //         {
    //         "coinType": "0x1798f84ee72176114ddbf5525a6d964c5f8ea1b3738d08d50d0d3de4cf584884::sbuck::SBUCK",
    //         "coinObjectId": "0x680a2ebdfd22c2fc89eaf534f2d1423f464c5137521793bba1e0c311c07838b7",
    //         "version": "634078590",
    //         "digest": "3rWyjuXfwmUZi2Eqdwa9T1DsXQhVjSqMHVG8SzLb1wVT",
    //         "balance": "76880255",
    //         "previousTransaction": "9A54Cq1x8BHaUr8TeQ8FfVejebBcjhHBRCSte5Eb9gAo"
    //         }
    //     ],
    //     "nextCursor": null,
    //     "hasNextPage": false
    // }

    if (!coin.data || coin.data.length === 0 || !coin.data[0]) {
        console.log("No BUCK coins found for the owner");
        return;
    }

    const firstCoin = coin.data[0];

    console.log(
        `Using coin: ${firstCoin.coinObjectId} with balance: ${firstCoin.balance}`
    );

    // Set the transaction sender
    tx.setSender(owner);

    const coinOut = buck.stakeSBUCK(tx, tx.object(firstCoin.coinObjectId));

    tx.transferObjects([coinOut], tx.pure.address(owner));

    try {
        // Set gas budget to avoid auto-determination issues
        tx.setGasBudget(10000000); // 0.01 SUI

        const result = await client.signAndExecuteTransaction({
            transaction: tx,
            signer: signer,
            options: {
                showEvents: true,
                showObjectChanges: true,
                showBalanceChanges: true,
            },
        });

        console.log(
            `signAndExecuteTransactionBlock result: ${JSON.stringify(
                result,
                null,
                2
            )}`
        );
    } catch (e) {
        console.error(e);
    }
}

async function main() {
    await call();
}

main();

// Using coin: 0x680a2ebdfd22c2fc89eaf534f2d1423f464c5137521793bba1e0c311c07838b7 with balance: 76880255
// signAndExecuteTransactionBlock result: {
//   "digest": "DSs6dE8bwvQWKnA5WTrjtPYpFzY7TCyyDsa7tVkdRiWM",
//   "events": [
//     {
//       "id": {
//         "txDigest": "DSs6dE8bwvQWKnA5WTrjtPYpFzY7TCyyDsa7tVkdRiWM",
//         "eventSeq": "0"
//       },
//       "packageId": "0x75b23bde4de9aca930d8c1f1780aa65ee777d8b33c3045b053a178b452222e82",
//       "transactionModule": "fountain_core",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "type": "0x75b23bde4de9aca930d8c1f1780aa65ee777d8b33c3045b053a178b452222e82::fountain_core::StakeEvent<0x1798f84ee72176114ddbf5525a6d964c5f8ea1b3738d08d50d0d3de4cf584884::sbuck::SBUCK, 0x2::sui::SUI>",
//       "parsedJson": {
//         "fountain_id": "0xbdf91f558c2b61662e5839db600198eda66d502e4c10c4fc5c683f9caca13359",
//         "lock_time": "4838400000",
//         "stake_amount": "76880255",
//         "stake_weight": "76880255",
//         "start_time": "1757496372322"
//       },
//       "bcsEncoding": "base64",
//       "bcs": "vfkfVYwrYWYuWDnbYAGY7aZtUC5MEMT8XGg/nKyhM1l/GZUEAAAAAH8ZlQQAAAAAACBkIAEAAABibPIymQEAAA=="
//     }
//   ],
//   "objectChanges": [
//     {
//       "type": "mutated",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "owner": {
//         "AddressOwner": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2"
//       },
//       "objectType": "0x2::coin::Coin<0x2::sui::SUI>",
//       "objectId": "0x92fe3cc7b2ae078fa27a75c72c9d66c73889cafd03bc7102350e1df12e300ac5",
//       "version": "634080429",
//       "previousVersion": "634080428",
//       "digest": "B6hk8ii1c2RQJgTyuU4YxNMQkKpMrTmnaXipX8tScrqM"
//     },
//     {
//       "type": "mutated",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "owner": {
//         "Shared": {
//           "initial_shared_version": 87170268
//         }
//       },
//       "objectType": "0x75b23bde4de9aca930d8c1f1780aa65ee777d8b33c3045b053a178b452222e82::fountain_core::Fountain<0x1798f84ee72176114ddbf5525a6d964c5f8ea1b3738d08d50d0d3de4cf584884::sbuck::SBUCK, 0x2::sui::SUI>",
//       "objectId": "0xbdf91f558c2b61662e5839db600198eda66d502e4c10c4fc5c683f9caca13359",
//       "version": "634080429",
//       "previousVersion": "634080428",
//       "digest": "7NYfm9iMBKZKnNZNcHHEmS5ob4oPQQURB9H4YYAibshm"
//     },
//     {
//       "type": "created",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "owner": {
//         "AddressOwner": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2"
//       },
//       "objectType": "0x75b23bde4de9aca930d8c1f1780aa65ee777d8b33c3045b053a178b452222e82::fountain_core::StakeProof<0x1798f84ee72176114ddbf5525a6d964c5f8ea1b3738d08d50d0d3de4cf584884::sbuck::SBUCK, 0x2::sui::SUI>",
//       "objectId": "0x649607514f6b60679c72c8bdf30122825ec6daad835b8602154ab40e60cb26b1",
//       "version": "634080429",
//       "digest": "5ymW11KsLd1NUyk4z3mcnxPqEf214VfsNU3Rza91GZvW"
//     },
//     {
//       "type": "deleted",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "objectType": "0x2::coin::Coin<0x1798f84ee72176114ddbf5525a6d964c5f8ea1b3738d08d50d0d3de4cf584884::sbuck::SBUCK>",
//       "objectId": "0x680a2ebdfd22c2fc89eaf534f2d1423f464c5137521793bba1e0c311c07838b7",
//       "version": "634080429"
//     }
//   ],
//   "balanceChanges": [
//     {
//       "owner": {
//         "AddressOwner": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2"
//       },
//       "coinType": "0x2::sui::SUI",
//       "amount": "-1796560"
//     },
//     {
//       "owner": {
//         "AddressOwner": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2"
//       },
//       "coinType": "0x1798f84ee72176114ddbf5525a6d964c5f8ea1b3738d08d50d0d3de4cf584884::sbuck::SBUCK",
//       "amount": "-76880255"
//     }
//   ],
//   "confirmedLocalExecution": false
// }
