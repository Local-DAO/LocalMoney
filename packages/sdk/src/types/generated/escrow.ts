/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/escrow.json`.
 */
export type Escrow = {
  "address": "CfpW1FrK41jj5tv1JRBxgRTqRr7Yeok9HeqnaUMg46VJ",
  "metadata": {
    "name": "escrow",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "LocalMoney Escrow Program - Token custody and release"
  },
  "instructions": [
    {
      "name": "freezeEscrow",
      "docs": [
        "Freeze escrow during dispute",
        "",
        "Prevents release of escrowed funds while a dispute is being resolved.",
        "",
        "# Arguments",
        "",
        "* `ctx` - FreezeEscrow context with vault PDA and hub_config",
        "",
        "# Access Control",
        "",
        "Only the Trade or Arbitrator programs (verified via Hub config) can call this instruction."
      ],
      "discriminator": [
        100,
        4,
        61,
        102,
        0,
        123,
        141,
        187
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.trade_id",
                "account": "escrowVault"
              }
            ]
          }
        },
        {
          "name": "callerProgram",
          "docs": [
            "The program claiming to be the caller (must match Hub's trade_program or arbitrator_program)"
          ]
        },
        {
          "name": "hubConfig",
          "docs": [
            "Hub config for authorization - verifies caller is Trade or Arbitrator program"
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
      "name": "fundEscrow",
      "docs": [
        "Fund an escrow for a trade",
        "",
        "Locks tokens in a PDA-controlled Associated Token Account for the duration",
        "of a trade. Only the Trade program should call this via CPI.",
        "",
        "# Arguments",
        "",
        "* `ctx` - FundEscrow context with vault PDA, token accounts, and hub_config",
        "* `trade_id` - Unique trade identifier",
        "* `params` - Amount to escrow",
        "",
        "# Access Control",
        "",
        "Only the Trade program (verified via Hub config) can call this instruction.",
        "",
        "# Security",
        "",
        "- Validates amount > 0",
        "- Uses PDA as vault authority (no one can steal funds)",
        "- Emits event for off-chain tracking"
      ],
      "discriminator": [
        155,
        18,
        218,
        141,
        182,
        213,
        69,
        201
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
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
          "name": "depositorTokenAccount",
          "docs": [
            "Depositor's token account"
          ],
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "docs": [
            "Vault's token account (ATA controlled by vault PDA)"
          ],
          "writable": true
        },
        {
          "name": "tokenMint",
          "docs": [
            "Token mint"
          ]
        },
        {
          "name": "depositor",
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
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
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
              "name": "fundEscrowParams"
            }
          }
        }
      ]
    },
    {
      "name": "refundEscrow",
      "docs": [
        "Refund escrowed tokens to depositor",
        "",
        "Returns the full escrowed amount to the original depositor.",
        "Used when a trade is canceled after escrow was funded.",
        "",
        "# Arguments",
        "",
        "* `ctx` - RefundEscrow context with vault, depositor token account, and hub_config",
        "",
        "# Access Control",
        "",
        "Only the Trade program (verified via Hub config) can call this instruction.",
        "",
        "# Security",
        "",
        "- Checks vault is funded",
        "- Checks vault is not frozen",
        "- Returns full amount (no fees on refunds)"
      ],
      "discriminator": [
        107,
        186,
        89,
        99,
        26,
        194,
        23,
        204
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.trade_id",
                "account": "escrowVault"
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "docs": [
            "Vault's token account"
          ],
          "writable": true
        },
        {
          "name": "depositorTokenAccount",
          "docs": [
            "Depositor's token account (refund destination)"
          ],
          "writable": true
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
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "releaseEscrow",
      "docs": [
        "Release escrowed tokens with fee distribution",
        "",
        "Distributes tokens to recipient with automatic fee deductions for:",
        "- Chain fee (to treasury)",
        "- Warchest fee",
        "- Arbitrator fee (if dispute was resolved)",
        "- Burn fee (retained/sent to burn address)",
        "",
        "# Arguments",
        "",
        "* `ctx` - ReleaseEscrow context with all recipient token accounts and hub_config",
        "* `params` - Fee percentages from Hub config",
        "",
        "# Access Control",
        "",
        "Only the Trade program (verified via Hub config) can call this instruction.",
        "",
        "# Security",
        "",
        "- Checks vault is not frozen",
        "- Validates fee configuration doesn't exceed 100%",
        "- Uses checked arithmetic for fee calculations",
        "- PDA signs all token transfers"
      ],
      "discriminator": [
        146,
        253,
        129,
        233,
        20,
        145,
        181,
        206
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.trade_id",
                "account": "escrowVault"
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "docs": [
            "Vault's token account"
          ],
          "writable": true
        },
        {
          "name": "recipientTokenAccount",
          "docs": [
            "Recipient's token account"
          ],
          "writable": true
        },
        {
          "name": "treasuryTokenAccount",
          "docs": [
            "Treasury token account (for chain fee)"
          ],
          "writable": true
        },
        {
          "name": "warchestTokenAccount",
          "docs": [
            "Warchest token account"
          ],
          "writable": true
        },
        {
          "name": "arbitratorTokenAccount",
          "docs": [
            "Arbitrator token account (optional, for disputes)"
          ],
          "writable": true,
          "optional": true
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
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "releaseEscrowParams"
            }
          }
        }
      ]
    },
    {
      "name": "unfreezeEscrow",
      "docs": [
        "Unfreeze escrow after dispute resolution",
        "",
        "Allows release of escrowed funds after arbitrator resolves the dispute.",
        "",
        "# Arguments",
        "",
        "* `ctx` - UnfreezeEscrow context with vault PDA and hub_config",
        "",
        "# Access Control",
        "",
        "Only the Arbitrator program (verified via Hub config) can call this instruction."
      ],
      "discriminator": [
        192,
        184,
        44,
        209,
        26,
        169,
        131,
        0
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.trade_id",
                "account": "escrowVault"
              }
            ]
          }
        },
        {
          "name": "callerProgram",
          "docs": [
            "The program claiming to be the caller (must match Hub's arbitrator_program)"
          ]
        },
        {
          "name": "hubConfig",
          "docs": [
            "Hub config for authorization - verifies caller is Arbitrator program"
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
    }
  ],
  "accounts": [
    {
      "name": "escrowVault",
      "discriminator": [
        54,
        84,
        41,
        149,
        160,
        181,
        85,
        114
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
      "name": "escrowFrozen",
      "discriminator": [
        143,
        99,
        44,
        214,
        144,
        68,
        69,
        249
      ]
    },
    {
      "name": "escrowFunded",
      "discriminator": [
        228,
        243,
        166,
        74,
        22,
        167,
        157,
        244
      ]
    },
    {
      "name": "escrowRefunded",
      "discriminator": [
        132,
        209,
        49,
        109,
        135,
        138,
        28,
        81
      ]
    },
    {
      "name": "escrowReleased",
      "discriminator": [
        131,
        7,
        138,
        104,
        166,
        190,
        113,
        112
      ]
    },
    {
      "name": "escrowUnfrozen",
      "discriminator": [
        128,
        58,
        130,
        127,
        208,
        162,
        166,
        47
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Unauthorized: only authorized programs can perform this action"
    },
    {
      "code": 6001,
      "name": "escrowFrozen",
      "msg": "Escrow is frozen due to dispute"
    },
    {
      "code": 6002,
      "name": "escrowNotFrozen",
      "msg": "Escrow is not frozen"
    },
    {
      "code": 6003,
      "name": "insufficientBalance",
      "msg": "Insufficient escrow balance"
    },
    {
      "code": 6004,
      "name": "invalidAmount",
      "msg": "Invalid token amount"
    },
    {
      "code": 6005,
      "name": "invalidFeeConfiguration",
      "msg": "Invalid fee configuration"
    },
    {
      "code": 6006,
      "name": "tokenMintMismatch",
      "msg": "Token mint mismatch"
    },
    {
      "code": 6007,
      "name": "alreadyFunded",
      "msg": "Escrow already funded"
    },
    {
      "code": 6008,
      "name": "notFunded",
      "msg": "Escrow not funded"
    },
    {
      "code": 6009,
      "name": "invalidRecipient",
      "msg": "Invalid recipient address"
    },
    {
      "code": 6010,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow in fee calculation"
    }
  ],
  "types": [
    {
      "name": "escrowFrozen",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tradeId",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "escrowFunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tradeId",
            "type": "u64"
          },
          {
            "name": "depositor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "escrowRefunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tradeId",
            "type": "u64"
          },
          {
            "name": "depositor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "escrowReleased",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tradeId",
            "type": "u64"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "fees",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "escrowUnfrozen",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "tradeId",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "escrowVault",
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
            "name": "tokenMint",
            "docs": [
              "Token mint address"
            ],
            "type": "pubkey"
          },
          {
            "name": "depositor",
            "docs": [
              "Depositor (who funded the escrow)"
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "docs": [
              "Amount deposited (in token lamports)"
            ],
            "type": "u64"
          },
          {
            "name": "isFunded",
            "docs": [
              "Whether escrow is funded"
            ],
            "type": "bool"
          },
          {
            "name": "isFrozen",
            "docs": [
              "Whether escrow is frozen (during dispute)"
            ],
            "type": "bool"
          },
          {
            "name": "fundedAt",
            "docs": [
              "Timestamps"
            ],
            "type": {
              "option": "i64"
            }
          },
          {
            "name": "releasedAt",
            "type": {
              "option": "i64"
            }
          }
        ]
      }
    },
    {
      "name": "fundEscrowParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "amount",
            "type": "u64"
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
      "name": "releaseEscrowParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "burnFeePct",
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
            "name": "arbitratorFeePct",
            "type": {
              "option": "u16"
            }
          }
        ]
      }
    }
  ]
};
