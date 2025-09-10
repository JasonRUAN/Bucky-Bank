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
const SUI_TYPE = "0x2::sui::SUI";

async function call() {
    const signer = getSigner(USER1_ADDR);
    const owner = await signer.toSuiAddress(); // Make sure to await the address

    const buck = new BucketClient();

    // const lpProofs = await buck.getUserLpProofs(owner);
    // console.log(lpProofs);

    // {
    //     '0x885e09419b395fcf5c8ee5e2b7c77e23b590e58ef3d61260b6b4eb44bbcc8c62': [],
    //     '0xe2569ee20149c2909f0f6527c210bc9d97047fe948d34737de5420fab2db7062': [],
    //     '0xb9d46d57d933fabaf9c81f4fc6f54f9c1570d3ef49785c6b7200cad6fe302909': [],
    //     '0x7778d68f02810b2c002b6f40084c5f3fe0b1bcc7d7a7c64d72ba40ff9a815bac': [],
    //     '0xae1910e5bcb13a4f5b12688f0da939b9c9d3e8a9e8d0a2e02c818f6a94e598fd': [],
    //     '0xcc39bcc2c438a79beb2656ff043714a60baf89ba37592bef2e14ee8bca0cf007': [],
    //     '0xbdf91f558c2b61662e5839db600198eda66d502e4c10c4fc5c683f9caca13359': [
    //         {
    //             objectId: '0x4e99d8e89a347badbd6b9a01b1b2f43af7f6df7d813cf3c149bb1e82e5ea72e9',
    //             version: '634096340',
    //             digest: 'FDhEhSfCHGvVTEeMfTQWmNJ9WaFUMFW89U1171Kfxkso',
    //             typeName: '0x75b23bde4de9aca930d8c1f1780aa65ee777d8b33c3045b053a178b452222e82::fountain_core::StakeProof<0x1798f84ee72176114ddbf5525a6d964c5f8ea1b3738d08d50d0d3de4cf584884::sbuck::SBUCK, 0x2::sui::SUI>',
    //             fountainId: '0xbdf91f558c2b61662e5839db600198eda66d502e4c10c4fc5c683f9caca13359',
    //             startUnit: 480202287868629940000,
    //             stakeAmount: 1685845516,
    //             stakeWeight: 1685845516,
    //             lockUntil: 1762338391568,
    //             isLocked: false
    //         },
    //         {
    //             objectId: '0x649607514f6b60679c72c8bdf30122825ec6daad835b8602154ab40e60cb26b1',
    //             version: '634080429',
    //             digest: '5ymW11KsLd1NUyk4z3mcnxPqEf214VfsNU3Rza91GZvW',
    //             typeName: '0x75b23bde4de9aca930d8c1f1780aa65ee777d8b33c3045b053a178b452222e82::fountain_core::StakeProof<0x1798f84ee72176114ddbf5525a6d964c5f8ea1b3738d08d50d0d3de4cf584884::sbuck::SBUCK, 0x2::sui::SUI>',
    //             fountainId: '0xbdf91f558c2b61662e5839db600198eda66d502e4c10c4fc5c683f9caca13359',
    //             startUnit: 480202200875641700000,
    //             stakeAmount: 76880255,
    //             stakeWeight: 76880255,
    //             lockUntil: 1762334772322,
    //             isLocked: false
    //         }
    //     ]
    // }

    const tx = new Transaction();
    const client = new SuiClient({ url: getFullnodeUrl("mainnet") });

    // Set the transaction sender
    tx.setSender(owner);

    const balanceOut = buck.claimSBUCK(
        tx,
        "0x649607514f6b60679c72c8bdf30122825ec6daad835b8602154ab40e60cb26b1"
    );

    const coinOut = tx.moveCall({
        target: "0x2::coin::from_balance",
        typeArguments: [SUI_TYPE],
        arguments: [balanceOut],
    });

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

// signAndExecuteTransactionBlock result: {
//   "digest": "25C5xZXZgYERsveMY3LfgPP4RfQJHnqxWgrG3KoZiX7J",
//   "events": [
//     {
//       "id": {
//         "txDigest": "25C5xZXZgYERsveMY3LfgPP4RfQJHnqxWgrG3KoZiX7J",
//         "eventSeq": "0"
//       },
//       "packageId": "0x75b23bde4de9aca930d8c1f1780aa65ee777d8b33c3045b053a178b452222e82",
//       "transactionModule": "fountain_core",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "type": "0x75b23bde4de9aca930d8c1f1780aa65ee777d8b33c3045b053a178b452222e82::fountain_core::ClaimEvent<0x1798f84ee72176114ddbf5525a6d964c5f8ea1b3738d08d50d0d3de4cf584884::sbuck::SBUCK, 0x2::sui::SUI>",
//       "parsedJson": {
//         "claim_time": "1757500675925",
//         "fountain_id": "0xbdf91f558c2b61662e5839db600198eda66d502e4c10c4fc5c683f9caca13359",
//         "reward_amount": "431"
//       },
//       "bcsEncoding": "base64",
//       "bcs": "vfkfVYwrYWYuWDnbYAGY7aZtUC5MEMT8XGg/nKyhM1mvAQAAAAAAAFUXNDOZAQAA"
//     }
//   ],
//   "objectChanges": [
//     {
//       "type": "mutated",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "owner": {
//         "AddressOwner": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2"
//       },
//       "objectType": "0x75b23bde4de9aca930d8c1f1780aa65ee777d8b33c3045b053a178b452222e82::fountain_core::StakeProof<0x1798f84ee72176114ddbf5525a6d964c5f8ea1b3738d08d50d0d3de4cf584884::sbuck::SBUCK, 0x2::sui::SUI>",
//       "objectId": "0x649607514f6b60679c72c8bdf30122825ec6daad835b8602154ab40e60cb26b1",
//       "version": "634096615",
//       "previousVersion": "634096614",
//       "digest": "G3oqGgzxxjjMdaq78z4xbqz5N9nQEBekD4mJszEX1gHu"
//     },
//     {
//       "type": "mutated",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "owner": {
//         "AddressOwner": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2"
//       },
//       "objectType": "0x2::coin::Coin<0x2::sui::SUI>",
//       "objectId": "0x92fe3cc7b2ae078fa27a75c72c9d66c73889cafd03bc7102350e1df12e300ac5",
//       "version": "634096615",
//       "previousVersion": "634096614",
//       "digest": "Hzp19hLDajDHysCd661raRttaFxMcyVqynt5juHwq9ZU"
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
//       "version": "634096615",
//       "previousVersion": "634096614",
//       "digest": "9Tg7VN1bihdHv7jtCdki5YisBGkYWsh3di7oKpwdFhKg"
//     },
//     {
//       "type": "created",
//       "sender": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//       "owner": {
//         "AddressOwner": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2"
//       },
//       "objectType": "0x2::coin::Coin<0x2::sui::SUI>",
//       "objectId": "0x5ec200cbe1fb4ff86466ca2033926c41bdeb51911164ff1e525f45379254da57",
//       "version": "634096615",
//       "digest": "G6HVk6FJTK3bKHx4Akxe2TZQy9UDgKdD5krdj26DKgSs"
//     }
//   ],
//   "balanceChanges": [
//     {
//       "owner": {
//         "AddressOwner": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2"
//       },
//       "coinType": "0x2::sui::SUI",
//       "amount": "-1550193"
//     }
//   ],
//   "confirmedLocalExecution": false
// }
