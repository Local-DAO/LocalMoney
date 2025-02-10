import { TextDecoder, TextEncoder } from 'util'
import { jest } from '@jest/globals'
import dotenv from 'dotenv'
import { setupProtocol } from './utils'
import type { TestCosmosChain } from './network/TestCosmosChain'
import 'isomorphic-fetch'

dotenv.config()
Object.assign(global, { TextEncoder, TextDecoder })

let takerClient: TestCosmosChain
let adminClient: TestCosmosChain

jest.setTimeout(60 * 1000)
let tradeAddr = ''
beforeAll(async () => {
  const result = await setupProtocol()
  takerClient = result.takerClient
  adminClient = result.adminClient
  tradeAddr = takerClient.getHubInfo().hubConfig.trade_addr
})

describe('fees tests', () => {
  it('should register conversion route for KUJI', async () => {
    await adminClient.getCwClient().execute(
      adminClient.getWalletAddress(),
      tradeAddr,
      {
        register_conversion_route_for_denom: {
          denom: { native: 'untrn' },
          route: [
            {
              ask_asset: {
                native: process.env.LOCAL_DENOM,
              },
              offer_asset: { native: 'untrn' },
              pool: process.env.LOCAL_MARKET,
            },
          ],
        },
      },
      'auto'
    )
  })
  it('should register conversion route for NTRN', async () => {
    const untrn = { native: 'untrn' }
    await adminClient.getCwClient().execute(
      adminClient.getWalletAddress(),
      tradeAddr,
      {
        register_conversion_route_for_denom: {
          denom: untrn,
          route: [],
        },
      },
      'auto'
    )
  })
})
