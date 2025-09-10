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
        coinType: BUCK_TYPE,
    });

    console.log(JSON.stringify(coin, null, 2));
    // {
    //     "data": [
    //         {
    //         "coinType": "0xce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2::buck::BUCK",
    //         "coinObjectId": "0xe9392db3f04f952d35b84cc9a7aeb4cbf8270b00226317b9d331c6f01f3bf6cc",
    //         "version": "634065296",
    //         "digest": "HSYVEr2dqNr6gAx5eAonM3eXM7oNAHePEkM4kacW5Zzm",
    //         "balance": "77770000",
    //         "previousTransaction": "3ejEdUW5vmJ4SjoTecjwfFivyrU8eJ8VdC43Ne7YB1aG"
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

    // Convert BUCK to sBUCK
    const balanceOut = buck.depositSBUCK(tx, tx.object(firstCoin.coinObjectId));
    if (!balanceOut) {
        console.log("No balanceOut found");
        return;
    }

    // Convert balance to coin for transfer
    const coinOut = tx.moveCall({
        target: "0x2::coin::from_balance",
        typeArguments: [sBUCK_TYPE],
        arguments: [balanceOut],
    });

    tx.transferObjects([coinOut], tx.pure.address(owner));

    // buck.stakeSBUCK(tx, balanceOut);

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

// Using coin: 0xe9392db3f04f952d35b84cc9a7aeb4cbf8270b00226317b9d331c6f01f3bf6cc with balance: 77770000
// signAndExecuteTransactionBlock result: {
//   "digest": "9A54Cq1x8BHaUr8TeQ8FfVejebBcjhHBRCSte5Eb9gAo",
//   "events": [
//     {
//       "id": {
//         "txDigest": "9A54Cq1x8BHaUr8TeQ8FfVejebBcjhHBRCSte5Eb9gAo",
//         "eventSeq": "0"
//       },
//       "packageId": "0x0b6ba9889bb71abc5fa89e4ad5db12e63bc331dba858019dd8d701bc91184d79",
//       "transactionModule": "buck",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "type": "0xce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2::buck_events::BuckMinted",
//       "parsedJson": {
//         "buck_amount": "0",
//         "collateral_type": "1798f84ee72176114ddbf5525a6d964c5f8ea1b3738d08d50d0d3de4cf584884::sbuck::SBUCK"
//       },
//       "bcsEncoding": "base64",
//       "bcs": "TjE3OThmODRlZTcyMTc2MTE0ZGRiZjU1MjVhNmQ5NjRjNWY4ZWExYjM3MzhkMDhkNTBkMGQzZGU0Y2Y1ODQ4ODQ6OnNidWNrOjpTQlVDSwAAAAAAAAAA"
//     },
//     {
//       "id": {
//         "txDigest": "9A54Cq1x8BHaUr8TeQ8FfVejebBcjhHBRCSte5Eb9gAo",
//         "eventSeq": "1"
//       },
//       "packageId": "0x0b6ba9889bb71abc5fa89e4ad5db12e63bc331dba858019dd8d701bc91184d79",
//       "transactionModule": "buck",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "type": "0x1798f84ee72176114ddbf5525a6d964c5f8ea1b3738d08d50d0d3de4cf584884::event::CollectRewards",
//       "parsedJson": {
//         "buck_amount": "0"
//       },
//       "bcsEncoding": "base64",
//       "bcs": "AAAAAAAAAAA="
//     },
//     {
//       "id": {
//         "txDigest": "9A54Cq1x8BHaUr8TeQ8FfVejebBcjhHBRCSte5Eb9gAo",
//         "eventSeq": "2"
//       },
//       "packageId": "0x0b6ba9889bb71abc5fa89e4ad5db12e63bc331dba858019dd8d701bc91184d79",
//       "transactionModule": "buck",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "type": "0x1798f84ee72176114ddbf5525a6d964c5f8ea1b3738d08d50d0d3de4cf584884::event::Deposit",
//       "parsedJson": {
//         "buck_amount": "77770000",
//         "sbuck_share": "76880255"
//       },
//       "bcsEncoding": "base64",
//       "bcs": "EK2iBAAAAAB/GZUEAAAAAA=="
//     }
//   ],
//   "objectChanges": [
//     {
//       "type": "mutated",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "owner": {
//         "ObjectOwner": "0xe03b7eaadce93c2f63d78fcaa07091291679dd76e3f915aad5f76c295f63bc2e"
//       },
//       "objectType": "0xb71c0893203d0f59622fc3fac849d0833de559d7503af21c5daf880d60d754ed::buck::SBuckEmission",
//       "objectId": "0x4a9c3a7f42ead76b350e268976c502eafb448ff72da02923efcd4d202e46dee4",
//       "version": "634078590",
//       "previousVersion": "634078589",
//       "digest": "BeguvBqKj8vcaUsYd4CfELJdp97s7qN2DakyFiPgKQn8"
//     },
//     {
//       "type": "mutated",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "owner": {
//         "AddressOwner": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2"
//       },
//       "objectType": "0x2::coin::Coin<0x2::sui::SUI>",
//       "objectId": "0x92fe3cc7b2ae078fa27a75c72c9d66c73889cafd03bc7102350e1df12e300ac5",
//       "version": "634078590",
//       "previousVersion": "634071098",
//       "digest": "5q4JaqK1CMDpy6wHYttWeZ9iYFw3yXQkrSLssihHNyWg"
//     },
//     {
//       "type": "mutated",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "owner": {
//         "Shared": {
//           "initial_shared_version": 6365975
//         }
//       },
//       "objectType": "0xce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2::buck::BucketProtocol",
//       "objectId": "0x9e3dab13212b27f5434416939db5dec6a319d15b89a84fd074d03ece6350d3df",
//       "version": "634078590",
//       "previousVersion": "634078589",
//       "digest": "AeCUq8afjF3iokX5QgEGgFgTENXVeyHm2y2b2x16fpSo"
//     },
//     {
//       "type": "mutated",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "owner": {
//         "Shared": {
//           "initial_shared_version": 90706194
//         }
//       },
//       "objectType": "0x1798f84ee72176114ddbf5525a6d964c5f8ea1b3738d08d50d0d3de4cf584884::sbuck::Flask<0xce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2::buck::BUCK>",
//       "objectId": "0xc6ecc9731e15d182bc0a46ebe1754a779a4bfb165c201102ad51a36838a1a7b8",
//       "version": "634078590",
//       "previousVersion": "634078589",
//       "digest": "B2Qf6n1TMkT8dtJChdfg8AP8cYBVkQaSyc7KPYbMaa7s"
//     },
//     {
//       "type": "created",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "owner": {
//         "AddressOwner": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2"
//       },
//       "objectType": "0x2::coin::Coin<0x1798f84ee72176114ddbf5525a6d964c5f8ea1b3738d08d50d0d3de4cf584884::sbuck::SBUCK>",
//       "objectId": "0x680a2ebdfd22c2fc89eaf534f2d1423f464c5137521793bba1e0c311c07838b7",
//       "version": "634078590",
//       "digest": "3rWyjuXfwmUZi2Eqdwa9T1DsXQhVjSqMHVG8SzLb1wVT"
//     },
//     {
//       "type": "deleted",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "objectType": "0x2::coin::Coin<0xce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2::buck::BUCK>",
//       "objectId": "0xe9392db3f04f952d35b84cc9a7aeb4cbf8270b00226317b9d331c6f01f3bf6cc",
//       "version": "634078590"
//     }
//   ],
//   "balanceChanges": [
//     {
//       "owner": {
//         "AddressOwner": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2"
//       },
//       "coinType": "0x2::sui::SUI",
//       "amount": "-1089984"
//     },
//     {
//       "owner": {
//         "AddressOwner": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2"
//       },
//       "coinType": "0x1798f84ee72176114ddbf5525a6d964c5f8ea1b3738d08d50d0d3de4cf584884::sbuck::SBUCK",
//       "amount": "76880255"
//     },
//     {
//       "owner": {
//         "AddressOwner": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2"
//       },
//       "coinType": "0xce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2::buck::BUCK",
//       "amount": "-77770000"
//     }
//   ],
//   "confirmedLocalExecution": false
// }
