/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/arbitrator.json`.
 */
export type Arbitrator = {
  "address": "J5BNGJ128bxHuWemwaoGkDqy8DVSvsA7o5kpdy9eDoNe",
  "metadata": {
    "name": "arbitrator",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "LocalMoney Arbitrator Program - Dispute resolution system"
  },
  "instructions": [
    {
      "name": "assignArbitrator",
      "docs": [
        "Assign an arbitrator to a disputed trade",
        "",
        "Called by the Trade program when a dispute is initiated.",
        "Selects an arbitrator for the given fiat currency.",
        "",
        "# Arguments",
        "",
        "* `ctx` - AssignArbitrator context with hub_config for authorization",
        "* `trade_id` - ID of the disputed trade",
        "* `params` - Buyer, seller, and fiat currency",
        "",
        "# Access Control",
        "",
        "Only the Trade program (verified via Hub config) can call this instruction.",
        "",
        "# Selection Algorithm",
        "",
        "Currently uses a provided arbitrator account. In production,",
        "this could be enhanced with random selection from available arbitrators."
      ],
      "discriminator": [
        227,
        183,
        153,
        251,
        4,
        55,
        13,
        56
      ],
      "accounts": [
        {
          "name": "dispute",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "tradeId"
              }
            ]
          }
        },
        {
          "name": "arbitrator",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  114,
                  98,
                  105,
                  116,
                  114,
                  97,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "arbitrator.pubkey",
                "account": "arbitrator"
              },
              {
                "kind": "account",
                "path": "arbitrator.fiat_currency",
                "account": "arbitrator"
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
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
            "Hub config for authorization - verifies caller is Trade program"
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
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "tradeId",
          "type": "u64"
        },
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "assignArbitratorParams"
            }
          }
        }
      ]
    },
    {
      "name": "registerArbitrator",
      "docs": [
        "Register a new arbitrator for a specific fiat currency",
        "",
        "Admin-only operation to add arbitrators to the system.",
        "",
        "# Arguments",
        "",
        "* `ctx` - RegisterArbitrator context with hub_config for admin verification",
        "* `arbitrator_pubkey` - Public key of the arbitrator",
        "* `fiat_currency` - Fiat currency code (ISO 4217)",
        "",
        "# Access Control",
        "",
        "Only the Hub admin (verified via Hub config) can register arbitrators."
      ],
      "discriminator": [
        141,
        158,
        50,
        47,
        214,
        118,
        229,
        183
      ],
      "accounts": [
        {
          "name": "arbitrator",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  114,
                  98,
                  105,
                  116,
                  114,
                  97,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "arbitratorPubkey"
              },
              {
                "kind": "arg",
                "path": "fiatCurrency"
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
          "name": "hubConfig",
          "docs": [
            "Hub config PDA for admin verification"
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
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "arbitratorPubkey",
          "type": "pubkey"
        },
        {
          "name": "fiatCurrency",
          "type": {
            "array": [
              "u8",
              3
            ]
          }
        }
      ]
    },
    {
      "name": "removeArbitrator",
      "docs": [
        "Remove (deactivate) an arbitrator",
        "",
        "Admin-only operation to deactivate arbitrators.",
        "",
        "# Arguments",
        "",
        "* `ctx` - RemoveArbitrator context with hub_config for admin verification",
        "",
        "# Access Control",
        "",
        "Only the Hub admin (verified via Hub config) can remove arbitrators."
      ],
      "discriminator": [
        177,
        100,
        82,
        152,
        42,
        54,
        58,
        95
      ],
      "accounts": [
        {
          "name": "arbitrator",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  114,
                  98,
                  105,
                  116,
                  114,
                  97,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "arbitrator.pubkey",
                "account": "arbitrator"
              },
              {
                "kind": "account",
                "path": "arbitrator.fiat_currency",
                "account": "arbitrator"
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "hubConfig",
          "docs": [
            "Hub config PDA for admin verification"
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
      "args": []
    },
    {
      "name": "resolveDispute",
      "docs": [
        "Resolve a dispute",
        "",
        "Arbitrator makes final decision on who wins the dispute.",
        "",
        "# Arguments",
        "",
        "* `ctx` - ResolveDispute context",
        "* `params` - Resolution (BuyerWins or SellerWins)",
        "",
        "# Access Control",
        "",
        "Only the assigned arbitrator can resolve the dispute.",
        "",
        "# Effects",
        "",
        "- Marks dispute as resolved",
        "- Increments arbitrator's resolution count",
        "- Emits event for Trade program to process",
        "- Trade program should unfreeze and release escrow based on resolution"
      ],
      "discriminator": [
        231,
        6,
        202,
        6,
        96,
        103,
        12,
        230
      ],
      "accounts": [
        {
          "name": "dispute",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "dispute.trade_id",
                "account": "dispute"
              }
            ]
          }
        },
        {
          "name": "arbitrator",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  114,
                  98,
                  105,
                  116,
                  114,
                  97,
                  116,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "arbitrator.pubkey",
                "account": "arbitrator"
              },
              {
                "kind": "account",
                "path": "arbitrator.fiat_currency",
                "account": "arbitrator"
              }
            ]
          }
        },
        {
          "name": "arbitratorSigner",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "resolveDisputeParams"
            }
          }
        }
      ]
    },
    {
      "name": "submitEvidence",
      "docs": [
        "Submit evidence for a dispute",
        "",
        "Allows buyer or seller to submit their evidence/explanation.",
        "",
        "# Arguments",
        "",
        "* `ctx` - SubmitEvidence context",
        "* `params` - Evidence text and whether submitter is buyer",
        "",
        "# Access Control",
        "",
        "Only the buyer or seller of the disputed trade can submit evidence.",
        "",
        "# Security",
        "",
        "- Evidence can only be submitted once per party",
        "- Maximum length enforced (500 chars)",
        "- Stored on-chain as string (consider IPFS hash for large evidence)"
      ],
      "discriminator": [
        12,
        169,
        228,
        194,
        229,
        31,
        44,
        39
      ],
      "accounts": [
        {
          "name": "dispute",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "dispute.trade_id",
                "account": "dispute"
              }
            ]
          }
        },
        {
          "name": "submitter",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "submitEvidenceParams"
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "arbitrator",
      "discriminator": [
        85,
        123,
        106,
        57,
        25,
        249,
        89,
        192
      ]
    },
    {
      "name": "dispute",
      "discriminator": [
        36,
        49,
        241,
        67,
        40,
        36,
        241,
        74
      ]
    },
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
    }
  ],
  "events": [
    {
      "name": "arbitratorAssigned",
      "discriminator": [
        94,
        253,
        243,
        225,
        29,
        169,
        99,
        110
      ]
    },
    {
      "name": "arbitratorRegistered",
      "discriminator": [
        74,
        66,
        60,
        131,
        232,
        53,
        205,
        93
      ]
    },
    {
      "name": "arbitratorRemoved",
      "discriminator": [
        95,
        191,
        171,
        10,
        172,
        249,
        200,
        162
      ]
    },
    {
      "name": "disputeResolved",
      "discriminator": [
        121,
        64,
        249,
        153,
        139,
        128,
        236,
        187
      ]
    },
    {
      "name": "evidenceSubmitted",
      "discriminator": [
        13,
        123,
        197,
        44,
        231,
        117,
        168,
        53
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Unauthorized: only admin can perform this action"
    },
    {
      "code": 6001,
      "name": "alreadyRegistered",
      "msg": "Arbitrator already registered for this fiat currency"
    },
    {
      "code": 6002,
      "name": "notFound",
      "msg": "Arbitrator not found for this fiat currency"
    },
    {
      "code": 6003,
      "name": "notActive",
      "msg": "Arbitrator is not active"
    },
    {
      "code": 6004,
      "name": "noArbitratorsAvailable",
      "msg": "No arbitrators available for this fiat currency"
    },
    {
      "code": 6005,
      "name": "invalidFiatCurrency",
      "msg": "Invalid fiat currency code"
    },
    {
      "code": 6006,
      "name": "notAssignedArbitrator",
      "msg": "Only assigned arbitrator can resolve dispute"
    },
    {
      "code": 6007,
      "name": "evidenceAlreadySubmitted",
      "msg": "Evidence already submitted"
    },
    {
      "code": 6008,
      "name": "evidenceTooLong",
      "msg": "Evidence exceeds maximum length"
    },
    {
      "code": 6009,
      "name": "disputeAlreadyResolved",
      "msg": "Dispute already resolved"
    },
    {
      "code": 6010,
      "name": "disputeNotFound",
      "msg": "Dispute not found"
    },
    {
      "code": 6011,
      "name": "conflictOfInterest",
      "msg": "Cannot arbitrate own trade"
    }
  ],
  "types": [
    {
      "name": "arbitrator",
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
            "name": "pubkey",
            "docs": [
              "Arbitrator's public key"
            ],
            "type": "pubkey"
          },
          {
            "name": "fiatCurrency",
            "docs": [
              "Fiat currency this arbitrator handles (ISO 4217 code)"
            ],
            "type": {
              "array": [
                "u8",
                3
              ]
            }
          },
          {
            "name": "isActive",
            "docs": [
              "Whether arbitrator is active"
            ],
            "type": "bool"
          },
          {
            "name": "totalDisputes",
            "docs": [
              "Statistics"
            ],
            "type": "u64"
          },
          {
            "name": "resolvedDisputes",
            "type": "u64"
          },
          {
            "name": "registeredAt",
            "docs": [
              "Registration timestamp"
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "arbitratorAssigned",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tradeId",
            "type": "u64"
          },
          {
            "name": "arbitrator",
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "seller",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "arbitratorRegistered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "arbitrator",
            "type": "pubkey"
          },
          {
            "name": "fiatCurrency",
            "type": {
              "array": [
                "u8",
                3
              ]
            }
          }
        ]
      }
    },
    {
      "name": "arbitratorRemoved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "arbitrator",
            "type": "pubkey"
          },
          {
            "name": "fiatCurrency",
            "type": {
              "array": [
                "u8",
                3
              ]
            }
          }
        ]
      }
    },
    {
      "name": "assignArbitratorParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "seller",
            "type": "pubkey"
          },
          {
            "name": "fiatCurrency",
            "type": {
              "array": [
                "u8",
                3
              ]
            }
          }
        ]
      }
    },
    {
      "name": "dispute",
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
            "name": "tradeId",
            "docs": [
              "Associated trade ID"
            ],
            "type": "u64"
          },
          {
            "name": "buyer",
            "docs": [
              "Buyer's public key"
            ],
            "type": "pubkey"
          },
          {
            "name": "seller",
            "docs": [
              "Seller's public key"
            ],
            "type": "pubkey"
          },
          {
            "name": "arbitrator",
            "docs": [
              "Assigned arbitrator"
            ],
            "type": "pubkey"
          },
          {
            "name": "buyerEvidence",
            "docs": [
              "Buyer's evidence (hash or short description)"
            ],
            "type": {
              "option": "string"
            }
          },
          {
            "name": "sellerEvidence",
            "docs": [
              "Seller's evidence (hash or short description)"
            ],
            "type": {
              "option": "string"
            }
          },
          {
            "name": "resolution",
            "docs": [
              "Resolution decision"
            ],
            "type": {
              "option": {
                "defined": {
                  "name": "disputeResolution"
                }
              }
            }
          },
          {
            "name": "createdAt",
            "docs": [
              "Timestamps"
            ],
            "type": "i64"
          },
          {
            "name": "resolvedAt",
            "type": {
              "option": "i64"
            }
          }
        ]
      }
    },
    {
      "name": "disputeResolution",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "buyerWins"
          },
          {
            "name": "sellerWins"
          }
        ]
      }
    },
    {
      "name": "disputeResolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tradeId",
            "type": "u64"
          },
          {
            "name": "arbitrator",
            "type": "pubkey"
          },
          {
            "name": "resolution",
            "type": {
              "defined": {
                "name": "disputeResolution"
              }
            }
          },
          {
            "name": "buyer",
            "type": "pubkey"
          },
          {
            "name": "seller",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "evidenceSubmitted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tradeId",
            "type": "u64"
          },
          {
            "name": "submitter",
            "type": "pubkey"
          },
          {
            "name": "isBuyer",
            "type": "bool"
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
      "name": "resolveDisputeParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "resolution",
            "type": {
              "defined": {
                "name": "disputeResolution"
              }
            }
          }
        ]
      }
    },
    {
      "name": "submitEvidenceParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "evidence",
            "type": "string"
          },
          {
            "name": "isBuyer",
            "type": "bool"
          }
        ]
      }
    }
  ]
};
