import dotenv from "dotenv";
dotenv.config();
import { BucketClient } from "bucket-protocol-sdk";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { getSigner } from "./utils/sui_utils";
const USER1_ADDR = process.env.USER1!;

const USDC_TYPE =
    "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";

async function call() {
    const signer = getSigner(USER1_ADDR);
    const owner = await signer.toSuiAddress();

    const buck = new BucketClient();

    const tx = new Transaction();
    const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

    let usdc = await client.getCoins({
        owner,
        coinType: USDC_TYPE,
    });

    console.log(JSON.stringify(usdc, null, 2));

    // Check if usdc data exists and has coins
    if (!usdc.data || usdc.data.length === 0) {
        console.log("No USDC coins found for the owner");
        return;
    }

    const firstCoin = usdc.data[0]!; // Safe to use ! because we checked array length above

    // Convert USDC to BUCK
    const coinOut = buck.psmSwapIn(
        tx,
        USDC_TYPE,
        tx.object(firstCoin.coinObjectId)
    );

    tx.transferObjects([coinOut], tx.pure.address(owner));

    try {
        const result = await client.signAndExecuteTransaction({
            transaction: tx,
            signer: signer,
            options: {
                showEvents: true,
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

// signAndExecuteTransactionBlock result: {
//   "digest": "3ejEdUW5vmJ4SjoTecjwfFivyrU8eJ8VdC43Ne7YB1aG",
//   "events": [
//     {
//       "id": {
//         "txDigest": "3ejEdUW5vmJ4SjoTecjwfFivyrU8eJ8VdC43Ne7YB1aG",
//         "eventSeq": "0"
//       },
//       "packageId": "0x0b6ba9889bb71abc5fa89e4ad5db12e63bc331dba858019dd8d701bc91184d79",
//       "transactionModule": "buck",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "type": "0x275b6c59f68837f7c8d7076254373a5bb16e20e6435967defdd86f943e70a2db::reservoir_events::ChargeReservior<0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC>",
//       "parsedJson": {
//         "buck_amount": "77770000",
//         "inflow_amount": "77770"
//       },
//       "bcsEncoding": "base64",
//       "bcs": "yi8BAAAAAAAQraIEAAAAAA=="
//     },
//     {
//       "id": {
//         "txDigest": "3ejEdUW5vmJ4SjoTecjwfFivyrU8eJ8VdC43Ne7YB1aG",
//         "eventSeq": "1"
//       },
//       "packageId": "0x0b6ba9889bb71abc5fa89e4ad5db12e63bc331dba858019dd8d701bc91184d79",
//       "transactionModule": "buck",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "type": "0xce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2::buck_events::BuckMinted",
//       "parsedJson": {
//         "buck_amount": "77770000",
//         "collateral_type": "dba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC"
//       },
//       "bcsEncoding": "base64",
//       "bcs": "TGRiYTM0NjcyZTMwY2IwNjViMWY5M2UzYWI1NTMxODc2OGZkNmZlZjY2YzE1OTQyYzlmN2NiODQ2ZTJmOTAwZTc6OnVzZGM6OlVTREMQraIEAAAAAA=="
//     },
//     {
//       "id": {
//         "txDigest": "3ejEdUW5vmJ4SjoTecjwfFivyrU8eJ8VdC43Ne7YB1aG",
//         "eventSeq": "2"
//       },
//       "packageId": "0x0b6ba9889bb71abc5fa89e4ad5db12e63bc331dba858019dd8d701bc91184d79",
//       "transactionModule": "buck",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "type": "0xd9162764da404339384fe40487499dc867c3f1fa3eb870381c41a8b41458b0e5::well_events::CollectFeeFrom",
//       "parsedJson": {
//         "fee_amount": "0",
//         "from": "charge",
//         "well_type": "ce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2::buck::BUCK"
//       },
//       "bcsEncoding": "base64",
//       "bcs": "TGNlN2ZmNzdhODNlYTBjYjZmZDM5YmQ4NzQ4ZTJlYzg5YTNmNDFlOGVmZGMzZjRlYjEyM2UwY2EzN2IxODRkYjI6OmJ1Y2s6OkJVQ0sAAAAAAAAAAAZjaGFyZ2U="
//     },
//     {
//       "id": {
//         "txDigest": "3ejEdUW5vmJ4SjoTecjwfFivyrU8eJ8VdC43Ne7YB1aG",
//         "eventSeq": "3"
//       },
//       "packageId": "0x0b6ba9889bb71abc5fa89e4ad5db12e63bc331dba858019dd8d701bc91184d79",
//       "transactionModule": "buck",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "type": "0xce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2::well_events::CollectFee",
//       "parsedJson": {
//         "fee_amount": "0",
//         "well_type": "ce7ff77a83ea0cb6fd39bd8748e2ec89a3f41e8efdc3f4eb123e0ca37b184db2::buck::BUCK"
//       },
//       "bcsEncoding": "base64",
//       "bcs": "TGNlN2ZmNzdhODNlYTBjYjZmZDM5YmQ4NzQ4ZTJlYzg5YTNmNDFlOGVmZGMzZjRlYjEyM2UwY2EzN2IxODRkYjI6OmJ1Y2s6OkJVQ0sAAAAAAAAAAA=="
//     }
//   ],
//   "confirmedLocalExecution": false
// }
