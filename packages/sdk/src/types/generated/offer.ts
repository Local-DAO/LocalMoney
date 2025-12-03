/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/offer.json`.
 */
export type Offer = {
  "address": "CZR8LiYhioRCc9qYFBfMkQ3JnkgU2PfAD8fMLN5WrNDo",
  "metadata": {
    "name": "offer",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "LocalMoney Offer Program - Marketplace listing management"
  },
  "instructions": [
    {
      "name": "createOffer",
      "docs": [
        "Create a new offer",
        "",
        "Creates a new buy or sell offer on the marketplace.",
        "",
        "# Arguments",
        "",
        "* `ctx` - CreateOffer context with offer PDA, counter, owner, token mint, and hub_config",
        "* `params` - Offer parameters",
        "",
        "# Access Control",
        "",
        "Anyone can create an offer, subject to max_active_offers limit from Hub config.",
        "Profile program is called via CPI to update offer counters (with Hub-based authorization)."
      ],
      "discriminator": [
        237,
        233,
        192,
        168,
        248,
        7,
        249,
        241
      ],
      "accounts": [
        {
          "name": "offer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "counter.next_id",
                "account": "offerCounter"
              }
            ]
          }
        },
        {
          "name": "counter",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  102,
                  102,
                  101,
                  114,
                  95,
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "ownerProfile",
          "docs": [
            "Owner's profile (for limit checking and counter update)"
          ],
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
                "path": "owner"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                105,
                94,
                163,
                210,
                170,
                223,
                187,
                115,
                217,
                215,
                124,
                81,
                110,
                1,
                242,
                150,
                89,
                140,
                163,
                16,
                66,
                9,
                127,
                184,
                47,
                113,
                40,
                9,
                161,
                128,
                22,
                4
              ]
            }
          }
        },
        {
          "name": "hubConfig",
          "docs": [
            "Hub config (for max_active_offers limit and circuit breaker)"
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
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "profileProgram",
          "docs": [
            "Profile program for CPI"
          ],
          "address": "86KWUvm3YK3fsSqSF1iLCRB2mLmHFcGUozFvD823Npf5"
        },
        {
          "name": "offerProgram",
          "docs": [
            "The Offer program account for CPI caller identification"
          ],
          "address": "CZR8LiYhioRCc9qYFBfMkQ3JnkgU2PfAD8fMLN5WrNDo"
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
              "name": "createOfferParams"
            }
          }
        }
      ]
    },
    {
      "name": "deleteOffer",
      "docs": [
        "Delete an offer",
        "",
        "Permanently marks an offer as deleted. This is a terminal state.",
        "",
        "# Arguments",
        "",
        "* `ctx` - DeleteOffer context with offer PDA and owner",
        "",
        "# Access Control",
        "",
        "Only the offer owner can delete their offer."
      ],
      "discriminator": [
        144,
        92,
        174,
        254,
        109,
        200,
        70,
        39
      ],
      "accounts": [
        {
          "name": "offer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "offer.id",
                "account": "offer"
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "offer"
          ]
        },
        {
          "name": "ownerProfile",
          "docs": [
            "Owner's profile (for counter update)"
          ],
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
                "path": "owner"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                105,
                94,
                163,
                210,
                170,
                223,
                187,
                115,
                217,
                215,
                124,
                81,
                110,
                1,
                242,
                150,
                89,
                140,
                163,
                16,
                66,
                9,
                127,
                184,
                47,
                113,
                40,
                9,
                161,
                128,
                22,
                4
              ]
            }
          }
        },
        {
          "name": "hubConfig",
          "docs": [
            "Hub config for CPI authorization"
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
        },
        {
          "name": "profileProgram",
          "docs": [
            "Profile program for CPI"
          ],
          "address": "86KWUvm3YK3fsSqSF1iLCRB2mLmHFcGUozFvD823Npf5"
        },
        {
          "name": "offerProgram",
          "docs": [
            "The Offer program account for CPI caller identification"
          ],
          "address": "CZR8LiYhioRCc9qYFBfMkQ3JnkgU2PfAD8fMLN5WrNDo"
        }
      ],
      "args": []
    },
    {
      "name": "initializeCounter",
      "docs": [
        "Initialize the offer counter",
        "",
        "This must be called once before any offers can be created.",
        "It initializes the global offer counter PDA."
      ],
      "discriminator": [
        67,
        89,
        100,
        87,
        231,
        172,
        35,
        124
      ],
      "accounts": [
        {
          "name": "counter",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  102,
                  102,
                  101,
                  114,
                  95,
                  99,
                  111,
                  117,
                  110,
                  116,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "pauseOffer",
      "docs": [
        "Pause an offer",
        "",
        "Temporarily disables an offer without deleting it.",
        "",
        "# Arguments",
        "",
        "* `ctx` - PauseOffer context with offer PDA and owner",
        "",
        "# Access Control",
        "",
        "Only the offer owner can pause their offer."
      ],
      "discriminator": [
        72,
        238,
        195,
        199,
        72,
        37,
        240,
        228
      ],
      "accounts": [
        {
          "name": "offer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "offer.id",
                "account": "offer"
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "offer"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "resumeOffer",
      "docs": [
        "Resume a paused offer",
        "",
        "Re-activates a previously paused offer.",
        "",
        "# Arguments",
        "",
        "* `ctx` - ResumeOffer context with offer PDA and owner",
        "",
        "# Access Control",
        "",
        "Only the offer owner can resume their offer."
      ],
      "discriminator": [
        197,
        129,
        242,
        229,
        41,
        156,
        140,
        206
      ],
      "accounts": [
        {
          "name": "offer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "offer.id",
                "account": "offer"
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "offer"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "updateOffer",
      "docs": [
        "Update an existing offer",
        "",
        "Allows the offer owner to update price, amounts, or description.",
        "",
        "# Arguments",
        "",
        "* `ctx` - UpdateOffer context with offer PDA and owner",
        "* `params` - Updated parameters (all optional)",
        "",
        "# Access Control",
        "",
        "Only the offer owner can update their offer."
      ],
      "discriminator": [
        191,
        70,
        15,
        66,
        224,
        2,
        249,
        223
      ],
      "accounts": [
        {
          "name": "offer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "offer.id",
                "account": "offer"
              }
            ]
          }
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "offer"
          ]
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "updateOfferParams"
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
      "name": "offer",
      "discriminator": [
        215,
        88,
        60,
        71,
        170,
        162,
        73,
        229
      ]
    },
    {
      "name": "offerCounter",
      "discriminator": [
        37,
        184,
        37,
        52,
        165,
        183,
        150,
        245
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
      "name": "offerCreated",
      "discriminator": [
        31,
        236,
        215,
        144,
        75,
        45,
        157,
        87
      ]
    },
    {
      "name": "offerDeleted",
      "discriminator": [
        36,
        115,
        88,
        175,
        127,
        24,
        84,
        51
      ]
    },
    {
      "name": "offerPaused",
      "discriminator": [
        242,
        83,
        238,
        50,
        131,
        4,
        86,
        241
      ]
    },
    {
      "name": "offerResumed",
      "discriminator": [
        168,
        38,
        47,
        180,
        77,
        242,
        235,
        212
      ]
    },
    {
      "name": "offerUpdated",
      "discriminator": [
        148,
        115,
        79,
        188,
        0,
        21,
        230,
        29
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Unauthorized: only offer owner can perform this action"
    },
    {
      "code": 6001,
      "name": "invalidOfferType",
      "msg": "Invalid offer type"
    },
    {
      "code": 6002,
      "name": "invalidAmountRange",
      "msg": "Invalid amount range: min must be less than max"
    },
    {
      "code": 6003,
      "name": "invalidStateTransition",
      "msg": "Invalid state transition"
    },
    {
      "code": 6004,
      "name": "descriptionTooLong",
      "msg": "Description exceeds maximum length (280 characters)"
    },
    {
      "code": 6005,
      "name": "invalidFiatCurrency",
      "msg": "Invalid fiat currency code"
    },
    {
      "code": 6006,
      "name": "offerNotActive",
      "msg": "Offer is not active"
    },
    {
      "code": 6007,
      "name": "offerDeleted",
      "msg": "Offer is deleted"
    },
    {
      "code": 6008,
      "name": "maxActiveOffersReached",
      "msg": "Maximum active offers reached"
    },
    {
      "code": 6009,
      "name": "offerCounterOverflow",
      "msg": "Offer counter overflow"
    },
    {
      "code": 6010,
      "name": "newOffersPaused",
      "msg": "New offers are currently paused"
    }
  ],
  "types": [
    {
      "name": "createOfferParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "offerType",
            "type": {
              "defined": {
                "name": "offerType"
              }
            }
          },
          {
            "name": "fiatCurrency",
            "type": {
              "array": [
                "u8",
                3
              ]
            }
          },
          {
            "name": "minAmount",
            "type": "u64"
          },
          {
            "name": "maxAmount",
            "type": "u64"
          },
          {
            "name": "rate",
            "type": "u64"
          },
          {
            "name": "description",
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
      "name": "offer",
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
            "name": "id",
            "docs": [
              "Unique offer ID"
            ],
            "type": "u64"
          },
          {
            "name": "owner",
            "docs": [
              "Offer owner"
            ],
            "type": "pubkey"
          },
          {
            "name": "offerType",
            "docs": [
              "Offer type (Buy or Sell)"
            ],
            "type": {
              "defined": {
                "name": "offerType"
              }
            }
          },
          {
            "name": "state",
            "docs": [
              "Offer state"
            ],
            "type": {
              "defined": {
                "name": "offerState"
              }
            }
          },
          {
            "name": "fiatCurrency",
            "docs": [
              "Fiat currency code (ISO 4217, e.g., \"USD\")"
            ],
            "type": {
              "array": [
                "u8",
                3
              ]
            }
          },
          {
            "name": "tokenMint",
            "docs": [
              "SPL token mint"
            ],
            "type": "pubkey"
          },
          {
            "name": "minAmount",
            "docs": [
              "Minimum amount (token lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "maxAmount",
            "docs": [
              "Maximum amount (token lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "rate",
            "docs": [
              "Exchange rate (fiat cents per token unit)"
            ],
            "type": "u64"
          },
          {
            "name": "description",
            "docs": [
              "Description (max 280 chars)"
            ],
            "type": "string"
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
    },
    {
      "name": "offerCounter",
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
            "name": "nextId",
            "docs": [
              "Next offer ID to assign"
            ],
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "offerCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "offerId",
            "type": "u64"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "offerType",
            "type": {
              "defined": {
                "name": "offerType"
              }
            }
          },
          {
            "name": "fiatCurrency",
            "type": {
              "array": [
                "u8",
                3
              ]
            }
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "offerDeleted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "offerId",
            "type": "u64"
          },
          {
            "name": "owner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "offerPaused",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "offerId",
            "type": "u64"
          },
          {
            "name": "owner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "offerResumed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "offerId",
            "type": "u64"
          },
          {
            "name": "owner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "offerState",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "paused"
          },
          {
            "name": "deleted"
          }
        ]
      }
    },
    {
      "name": "offerType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "buy"
          },
          {
            "name": "sell"
          }
        ]
      }
    },
    {
      "name": "offerUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "offerId",
            "type": "u64"
          },
          {
            "name": "owner",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "updateOfferParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "minAmount",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "maxAmount",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "rate",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "description",
            "type": {
              "option": "string"
            }
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
