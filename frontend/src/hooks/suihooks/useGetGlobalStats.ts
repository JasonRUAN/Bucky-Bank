import { CONSTANTS } from "@/constants";
import { useGetObject } from "./useGetObject";
import { GlobalStatsData } from "@/types/move";

export function useGetGlobalStats() {
    const objectsData = useGetObject({
        objectId: CONSTANTS.BUCKY_BANK_CONTRACT.GLOBAL_STATS_SHARED_OBJECT_ID,
    });

    if (!objectsData) {
        return {
            data: null,
            isLoading: false,
            error: "global stats not found",
        };
    }

    let stats: GlobalStatsData | null = null;

    if (objectsData.data?.content && "fields" in objectsData.data.content) {
        stats = objectsData.data.content.fields as GlobalStatsData;
    }

    return {
        data: stats || null,
        isLoading: !stats,
        error: null,
    };
}

// {
//     "data": {
//       "objectId": "0x33c0ffc00ecd6172b944e48ea56f721930415911127d9d0041e1ca5a0f8cbefa",
//       "version": "646694137",
//       "digest": "EWye2N3AkJviVbq5av73L7JFUBSU4NnsW4oYwFiiJMwk",
//       "type": "0xbd3772597e24eccc66fa2d39aec3f008cf479f539a41606a38aedfc1966134f7::bucky_bank::GlobalStats",
//       "owner": {
//         "Shared": {
//           "initial_shared_version": 646694133
//         }
//       },
//       "content": {
//         "dataType": "moveObject",
//         "type": "0xbd3772597e24eccc66fa2d39aec3f008cf479f539a41606a38aedfc1966134f7::bucky_bank::GlobalStats",
//         "hasPublicTransfer": false,
//         "fields": {
//           "admin": "0x39ba7a5d7cbe921a5cdd76293345fd1e9ebbad354606edbfe1778eba80709de2",
//           "deposit_balances": {
//             "type": "0x2::vec_map::VecMap<address, 0x2::vec_map::VecMap<0x2::object::ID, u64>>",
//             "fields": {
//               "contents": [
//                 {
//                   "type": "0x2::vec_map::Entry<address, 0x2::vec_map::VecMap<0x2::object::ID, u64>>",
//                   "fields": {
//                     "key": "0xdb28f86c91cefa8a7ec5fea3cb7f6a14d27d6daa3e2b905702bba1303e58d3cc",
//                     "value": {
//                       "type": "0x2::vec_map::VecMap<0x2::object::ID, u64>",
//                       "fields": {
//                         "contents": [
//                           {
//                             "type": "0x2::vec_map::Entry<0x2::object::ID, u64>",
//                             "fields": {
//                               "key": "0x2c2553b80a45bbbf30ba28524d28155fdcec55128d917db3d6903dc41e7648a7",
//                               "value": "5000000"
//                             }
//                           },
//                           {
//                             "type": "0x2::vec_map::Entry<0x2::object::ID, u64>",
//                             "fields": {
//                               "key": "0xadf280690f7f060b91883eae4a9900cd9b0580d0b875d330f8dcb3714d6a961f",
//                               "value": "10000000"
//                             }
//                           }
//                         ]
//                       }
//                     }
//                   }
//                 }
//               ]
//             }
//           },
//           "id": {
//             "id": "0x33c0ffc00ecd6172b944e48ea56f721930415911127d9d0041e1ca5a0f8cbefa"
//           },
//           "platform_fees_collected": "0",
//           "reward_balances": {
//             "type": "0x2::vec_map::VecMap<address, 0x2::vec_map::VecMap<0x2::object::ID, 0x2::balance::Balance<0x2::sui::SUI>>>",
//             "fields": {
//               "contents": []
//             }
//           },
//           "total_bucky_banks": "2",
//           "total_deposits": "0",
//           "total_withdrawals": "0"
//         }
//       }
//     }
//   }
