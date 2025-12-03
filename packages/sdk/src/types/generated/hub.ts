/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/hub.json`.
 */
export type Hub = {
  "address": "8xemd2mhu4zi314H6nFTGgXKTVFji4evLSedxKVvk7jH",
  "metadata": {
    "name": "hub",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "LocalMoney Hub Program - Central configuration and registry"
  },
  "instructions": [
    {
      "name": "initialize",
      "docs": [
        "Initialize the Hub configuration",
        "",
        "This sets up the central configuration for the entire LocalMoney protocol,",
        "including program addresses, fee structure, trading limits, and circuit breakers.",
        "",
        "# Arguments",
        "",
        "* `ctx` - Initialize context with hub_config PDA and admin",
        "* `params` - Initial configuration parameters",
        "",
        "# Access Control",
        "",
        "Can only be called once to initialize the Hub config PDA."
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
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
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "initializeParams"
            }
          }
        }
      ]
    },
    {
      "name": "setCircuitBreaker",
      "docs": [
        "Set circuit breaker flags",
        "",
        "Allows the admin to pause specific protocol operations or the entire protocol.",
        "This is used for emergency situations or maintenance.",
        "",
        "# Arguments",
        "",
        "* `ctx` - SetCircuitBreaker context with hub_config PDA and admin",
        "* `params` - Circuit breaker flags (all optional)",
        "",
        "# Access Control",
        "",
        "Only the current admin can call this instruction.",
        "",
        "# Circuit Breaker Types",
        "",
        "* `global_pause` - Pauses all protocol operations",
        "* `pause_new_offers` - Prevents creation of new offers",
        "* `pause_new_trades` - Prevents creation of new trades",
        "* `pause_escrow_funding` - Prevents funding of escrows",
        "* `pause_escrow_release` - Prevents release of escrowed funds"
      ],
      "discriminator": [
        135,
        207,
        46,
        31,
        152,
        94,
        123,
        247
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
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
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "circuitBreakerParams"
            }
          }
        }
      ]
    },
    {
      "name": "transferAdmin",
      "docs": [
        "Transfer admin authority",
        "",
        "Transfers the admin role to a new address. This is a one-step transfer",
        "without requiring acceptance from the new admin.",
        "",
        "# Arguments",
        "",
        "* `ctx` - TransferAdmin context with hub_config PDA, current admin, and new admin",
        "",
        "# Access Control",
        "",
        "Only the current admin can call this instruction.",
        "",
        "# Security",
        "",
        "The new admin address is validated to ensure it's not the zero address."
      ],
      "discriminator": [
        42,
        242,
        66,
        106,
        228,
        10,
        111,
        156
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
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
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "newAdmin"
        }
      ],
      "args": []
    },
    {
      "name": "updateConfig",
      "docs": [
        "Update the Hub configuration",
        "",
        "Allows the admin to update any configuration parameters. All parameters",
        "are optional - only provided values will be updated.",
        "",
        "# Arguments",
        "",
        "* `ctx` - UpdateConfig context with hub_config PDA and admin signer",
        "* `params` - Updated configuration parameters (all optional)",
        "",
        "# Access Control",
        "",
        "Only the current admin can call this instruction."
      ],
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
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
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "updateConfigParams"
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
    }
  ],
  "events": [
    {
      "name": "adminTransferred",
      "discriminator": [
        255,
        147,
        182,
        5,
        199,
        217,
        38,
        179
      ]
    },
    {
      "name": "circuitBreakerSet",
      "discriminator": [
        3,
        73,
        7,
        135,
        88,
        126,
        203,
        24
      ]
    },
    {
      "name": "configUpdated",
      "discriminator": [
        40,
        241,
        230,
        122,
        11,
        19,
        198,
        194
      ]
    },
    {
      "name": "hubInitialized",
      "discriminator": [
        138,
        228,
        8,
        83,
        240,
        141,
        220,
        138
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
      "name": "invalidFeeConfiguration",
      "msg": "Invalid fee configuration: total fees exceed maximum allowed (10%)"
    },
    {
      "code": 6002,
      "name": "feeExceedsLimit",
      "msg": "Fee percentage exceeds individual limit"
    },
    {
      "code": 6003,
      "name": "invalidTradingLimit",
      "msg": "Invalid trading limit: min amount must be less than max amount"
    },
    {
      "code": 6004,
      "name": "invalidTimerValue",
      "msg": "Invalid timer value: must be greater than zero"
    },
    {
      "code": 6005,
      "name": "invalidAddress",
      "msg": "Invalid address: cannot be zero address"
    },
    {
      "code": 6006,
      "name": "globallyPaused",
      "msg": "Protocol is globally paused"
    },
    {
      "code": 6007,
      "name": "operationPaused",
      "msg": "Operation is paused"
    },
    {
      "code": 6008,
      "name": "invalidProgramAddress",
      "msg": "Invalid program address"
    }
  ],
  "types": [
    {
      "name": "adminTransferred",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "oldAdmin",
            "type": "pubkey"
          },
          {
            "name": "newAdmin",
            "type": "pubkey"
          },
          {
            "name": "configAddress",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "circuitBreakerParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "globalPause",
            "type": {
              "option": "bool"
            }
          },
          {
            "name": "pauseNewOffers",
            "type": {
              "option": "bool"
            }
          },
          {
            "name": "pauseNewTrades",
            "type": {
              "option": "bool"
            }
          },
          {
            "name": "pauseEscrowFunding",
            "type": {
              "option": "bool"
            }
          },
          {
            "name": "pauseEscrowRelease",
            "type": {
              "option": "bool"
            }
          }
        ]
      }
    },
    {
      "name": "circuitBreakerSet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "globalPause",
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
          }
        ]
      }
    },
    {
      "name": "configUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "configAddress",
            "type": "pubkey"
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
      "name": "hubInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "configAddress",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "initializeParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "offerProgram",
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
            "type": "u64"
          },
          {
            "name": "tradeDisputeTimer",
            "type": "u64"
          },
          {
            "name": "treasury",
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
      "name": "updateConfigParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "offerProgram",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "tradeProgram",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "profileProgram",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "escrowProgram",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "arbitratorProgram",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "priceOracleProgram",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "burnFeePct",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "chainFeePct",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "warchestFeePct",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "conversionFeePct",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "arbitratorFeePct",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "minTradeAmount",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "maxTradeAmount",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "maxActiveOffers",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "maxActiveTrades",
            "type": {
              "option": "u8"
            }
          },
          {
            "name": "tradeExpirationTimer",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "tradeDisputeTimer",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "treasury",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "warchest",
            "type": {
              "option": "pubkey"
            }
          }
        ]
      }
    }
  ]
};
