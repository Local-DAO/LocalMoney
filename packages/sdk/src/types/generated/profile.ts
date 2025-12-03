/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/profile.json`.
 */
export type Profile = {
  "address": "86KWUvm3YK3fsSqSF1iLCRB2mLmHFcGUozFvD823Npf5",
  "metadata": {
    "name": "profile",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "LocalMoney Profile Program - User reputation and statistics"
  },
  "instructions": [
    {
      "name": "createProfile",
      "docs": [
        "Create a new user profile",
        "",
        "Initializes a profile for a user with encrypted contact information.",
        "Each user can only have one profile.",
        "",
        "# Arguments",
        "",
        "* `ctx` - CreateProfile context with profile PDA and user",
        "* `params` - Contact information and encryption key",
        "",
        "# Access Control",
        "",
        "Can only be called once per user (PDA prevents duplicates)."
      ],
      "discriminator": [
        225,
        205,
        234,
        143,
        17,
        186,
        50,
        220
      ],
      "accounts": [
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "createProfileParams"
            }
          }
        }
      ]
    },
    {
      "name": "updateActiveCounters",
      "docs": [
        "Update active offers/trades counters",
        "",
        "Called by the Offer or Trade programs to increment/decrement counters",
        "when offers or trades are created/completed.",
        "",
        "# Arguments",
        "",
        "* `ctx` - UpdateActiveCounters context with profile, caller program, and hub_config",
        "* `params` - Counter type and operation (increment/decrement)",
        "",
        "# Access Control",
        "",
        "Only the Trade or Offer programs (verified via Hub config) can call this instruction."
      ],
      "discriminator": [
        161,
        123,
        53,
        159,
        141,
        68,
        216,
        254
      ],
      "accounts": [
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "profile.owner",
                "account": "userProfile"
              }
            ]
          }
        },
        {
          "name": "callerProgram",
          "docs": [
            "The program claiming to be the caller (must match Hub's trade_program or offer_program)"
          ]
        },
        {
          "name": "hubConfig",
          "docs": [
            "Hub config for authorization - verifies caller is authorized program"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  117,
                  98,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                118,
                67,
                117,
                122,
                164,
                251,
                236,
                143,
                39,
                234,
                202,
                7,
                8,
                0,
                75,
                48,
                206,
                65,
                61,
                29,
                231,
                32,
                159,
                221,
                71,
                20,
                138,
                111,
                39,
                178,
                82,
                244
              ]
            }
          }
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "updateActiveCountersParams"
            }
          }
        }
      ]
    },
    {
      "name": "updateContact",
      "docs": [
        "Update contact information",
        "",
        "Allows the profile owner to update their encrypted contact info or encryption key.",
        "",
        "# Arguments",
        "",
        "* `ctx` - UpdateContact context with profile PDA and owner",
        "* `params` - Updated contact information (optional fields)",
        "",
        "# Access Control",
        "",
        "Only the profile owner can update their contact information."
      ],
      "discriminator": [
        112,
        131,
        30,
        238,
        150,
        187,
        74,
        235
      ],
      "accounts": [
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "signer": true
        },
        {
          "name": "owner",
          "relations": [
            "profile"
          ]
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "updateContactParams"
            }
          }
        }
      ]
    },
    {
      "name": "updateTradeStats",
      "docs": [
        "Update trade statistics",
        "",
        "Called by the Trade program to update user's trading statistics after",
        "a trade completes or is disputed.",
        "",
        "# Arguments",
        "",
        "* `ctx` - UpdateTradeStats context with profile, caller program, and hub_config",
        "* `params` - Trade statistics to update",
        "",
        "# Access Control",
        "",
        "Only the Trade program (verified via Hub config) can call this instruction."
      ],
      "discriminator": [
        171,
        169,
        113,
        43,
        225,
        230,
        69,
        231
      ],
      "accounts": [
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "profile.owner",
                "account": "userProfile"
              }
            ]
          }
        },
        {
          "name": "callerProgram",
          "docs": [
            "The program claiming to be the caller (must match Hub's trade_program)"
          ]
        },
        {
          "name": "hubConfig",
          "docs": [
            "Hub config for authorization - verifies caller is authorized program"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  104,
                  117,
                  98,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                118,
                67,
                117,
                122,
                164,
                251,
                236,
                143,
                39,
                234,
                202,
                7,
                8,
                0,
                75,
                48,
                206,
                65,
                61,
                29,
                231,
                32,
                159,
                221,
                71,
                20,
                138,
                111,
                39,
                178,
                82,
                244
              ]
            }
          }
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "updateTradeStatsParams"
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "hubConfig",
      "discriminator": [
        115,
        89,
        81,
        4,
        182,
        207,
        219,
        46
      ]
    },
    {
      "name": "userProfile",
      "discriminator": [
        32,
        37,
        119,
        205,
        179,
        180,
        13,
        194
      ]
    }
  ],
  "events": [
    {
      "name": "activeCountersUpdated",
      "discriminator": [
        30,
        110,
        104,
        164,
        100,
        131,
        156,
        238
      ]
    },
    {
      "name": "contactUpdated",
      "discriminator": [
        55,
        64,
        84,
        142,
        43,
        152,
        215,
        46
      ]
    },
    {
      "name": "profileCreated",
      "discriminator": [
        134,
        233,
        199,
        153,
        77,
        206,
        128,
        94
      ]
    },
    {
      "name": "tradeStatsUpdated",
      "discriminator": [
        229,
        111,
        215,
        59,
        192,
        154,
        9,
        29
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Unauthorized: only profile owner can perform this action"
    },
    {
      "code": 6001,
      "name": "contactInfoTooLong",
      "msg": "Contact information exceeds maximum length (280 characters)"
    },
    {
      "code": 6002,
      "name": "encryptionKeyTooLong",
      "msg": "Encryption key exceeds maximum length (280 characters)"
    },
    {
      "code": 6003,
      "name": "unauthorizedProgramCall",
      "msg": "Unauthorized: only authorized programs can update profile statistics"
    },
    {
      "code": 6004,
      "name": "invalidCounterOperation",
      "msg": "Invalid counter operation: would result in negative value"
    },
    {
      "code": 6005,
      "name": "activeOffersOverflow",
      "msg": "Active offers counter overflow"
    },
    {
      "code": 6006,
      "name": "activeTradesOverflow",
      "msg": "Active trades counter overflow"
    }
  ],
  "types": [
    {
      "name": "activeCountersUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "activeOffers",
            "type": "u8"
          },
          {
            "name": "activeTrades",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "contactUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "profileAddress",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "counterOperation",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "increment"
          },
          {
            "name": "decrement"
          }
        ]
      }
    },
    {
      "name": "counterType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "activeOffers"
          },
          {
            "name": "activeTrades"
          }
        ]
      }
    },
    {
      "name": "createProfileParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "contactInfo",
            "type": "string"
          },
          {
            "name": "encryptionKey",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "hubConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "docs": [
              "PDA bump seed"
            ],
            "type": "u8"
          },
          {
            "name": "admin",
            "docs": [
              "Admin authority"
            ],
            "type": "pubkey"
          },
          {
            "name": "offerProgram",
            "docs": [
              "Program addresses"
            ],
            "type": "pubkey"
          },
          {
            "name": "tradeProgram",
            "type": "pubkey"
          },
          {
            "name": "profileProgram",
            "type": "pubkey"
          },
          {
            "name": "escrowProgram",
            "type": "pubkey"
          },
          {
            "name": "arbitratorProgram",
            "type": "pubkey"
          },
          {
            "name": "priceOracleProgram",
            "type": "pubkey"
          },
          {
            "name": "burnFeePct",
            "docs": [
              "Fee configuration (basis points, 10000 = 100%)"
            ],
            "type": "u16"
          },
          {
            "name": "chainFeePct",
            "type": "u16"
          },
          {
            "name": "warchestFeePct",
            "type": "u16"
          },
          {
            "name": "conversionFeePct",
            "type": "u16"
          },
          {
            "name": "arbitratorFeePct",
            "type": "u16"
          },
          {
            "name": "minTradeAmount",
            "docs": [
              "Trading limits (USD cents)"
            ],
            "type": "u64"
          },
          {
            "name": "maxTradeAmount",
            "type": "u64"
          },
          {
            "name": "maxActiveOffers",
            "type": "u8"
          },
          {
            "name": "maxActiveTrades",
            "type": "u8"
          },
          {
            "name": "tradeExpirationTimer",
            "docs": [
              "Timers (seconds)"
            ],
            "type": "u64"
          },
          {
            "name": "tradeDisputeTimer",
            "type": "u64"
          },
          {
            "name": "globalPause",
            "docs": [
              "Circuit breakers"
            ],
            "type": "bool"
          },
          {
            "name": "pauseNewOffers",
            "type": "bool"
          },
          {
            "name": "pauseNewTrades",
            "type": "bool"
          },
          {
            "name": "pauseEscrowFunding",
            "type": "bool"
          },
          {
            "name": "pauseEscrowRelease",
            "type": "bool"
          },
          {
            "name": "treasury",
            "docs": [
              "Treasury addresses"
            ],
            "type": "pubkey"
          },
          {
            "name": "warchest",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "profileCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "profileAddress",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "tradeStatsUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "totalTrades",
            "type": "u64"
          },
          {
            "name": "completedTrades",
            "type": "u64"
          },
          {
            "name": "disputedTrades",
            "type": "u64"
          },
          {
            "name": "reputationScore",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "updateActiveCountersParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "counterType",
            "type": {
              "defined": {
                "name": "counterType"
              }
            }
          },
          {
            "name": "operation",
            "type": {
              "defined": {
                "name": "counterOperation"
              }
            }
          }
        ]
      }
    },
    {
      "name": "updateContactParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "contactInfo",
            "type": {
              "option": "string"
            }
          },
          {
            "name": "encryptionKey",
            "type": {
              "option": "string"
            }
          }
        ]
      }
    },
    {
      "name": "updateTradeStatsParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "isBuy",
            "type": "bool"
          },
          {
            "name": "fiatAmount",
            "type": "u64"
          },
          {
            "name": "completed",
            "type": "bool"
          },
          {
            "name": "disputed",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "userProfile",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "docs": [
              "PDA bump seed"
            ],
            "type": "u8"
          },
          {
            "name": "owner",
            "docs": [
              "Profile owner"
            ],
            "type": "pubkey"
          },
          {
            "name": "contactInfo",
            "docs": [
              "Encrypted contact information (max 280 chars)"
            ],
            "type": "string"
          },
          {
            "name": "encryptionKey",
            "docs": [
              "Encryption key for contact info (max 280 chars)"
            ],
            "type": "string"
          },
          {
            "name": "totalTrades",
            "docs": [
              "Trading statistics"
            ],
            "type": "u64"
          },
          {
            "name": "completedTrades",
            "type": "u64"
          },
          {
            "name": "disputedTrades",
            "type": "u64"
          },
          {
            "name": "totalBuyVolume",
            "type": "u64"
          },
          {
            "name": "totalSellVolume",
            "type": "u64"
          },
          {
            "name": "activeOffers",
            "docs": [
              "Active counters (for limit enforcement)"
            ],
            "type": "u8"
          },
          {
            "name": "activeTrades",
            "type": "u8"
          },
          {
            "name": "reputationScore",
            "docs": [
              "Reputation score (0-10000 basis points, 10000 = 100%)"
            ],
            "type": "u16"
          },
          {
            "name": "createdAt",
            "docs": [
              "Timestamps"
            ],
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
