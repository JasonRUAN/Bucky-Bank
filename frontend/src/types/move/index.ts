export type DynamicFields = {
    type: string;
    fields: {
        id: {
            id: string;
        };
        size: string;
    };
};

export type FileRegistry = {
    id: string;
    files_by_owner: DynamicFields;
    shared_to_me_files: DynamicFields;
    market_files: string[];
    total_files: number;
};

export type FileDetail = {
    id: {
        id: string;
    };
    owner: string;
    name: string;
    description: string;
    file_blob_id: string;
    file_type: string;
    file_size: number;
    price: number; // 单位：MIST，1 MIST = 10^-9 SUI
    is_encrypt: boolean;
    created_at: number;
    access_list: string[];
};
