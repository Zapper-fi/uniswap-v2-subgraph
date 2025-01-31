/* eslint-disable prefer-const */
import { log, Address } from '@graphprotocol/graph-ts'
import { UniswapFactory, Pair, Token, Bundle } from '../types/schema'
import { PairCreated } from '../types/Factory/Factory'
import { Pair as PairTemplate } from '../types/templates'
import { FACTORY_ADDRESS, ZERO_BD, ZERO_BI, fetchTokenSymbol, fetchTokenName, fetchTokenDecimals } from './helpers'

export function handleNewPair(event: PairCreated): void {
  log.debug('New Exchange: {}', [event.params.pair.toHex()])

  // load factory (create if first exchange)
  let factory = UniswapFactory.load(FACTORY_ADDRESS)
  if (factory == null) {
    factory = new UniswapFactory(FACTORY_ADDRESS)
    factory.pairCount = 0
    factory.pairs = []
    factory.totalVolumeETH = ZERO_BD
    factory.totalLiquidityETH = ZERO_BD
    factory.totalVolumeUSD = ZERO_BD
    factory.totalLiquidityUSD = ZERO_BD
    factory.txCount = ZERO_BI
    factory.mostLiquidTokens = []

    // create new bundle
    let bundle = new Bundle('1')
    bundle.ethPrice = ZERO_BD
    bundle.save()
  }
  factory.pairCount = factory.pairCount + 1
  factory.save()

  // create the tokens
  let token0 = Token.load(event.params.token0.toHexString())
  let token1 = Token.load(event.params.token1.toHexString())

  // fetch info if null
  if (token0 == null) {
    token0 = new Token(event.params.token0.toHexString())
    token0.symbol = fetchTokenSymbol(event.params.token0)
    token0.name = fetchTokenName(event.params.token0)
    let decimals = fetchTokenDecimals(event.params.token0)
    // bail if we couldn't figure out the decimals
    if (decimals === null) {
      return
    }
    token0.decimals = decimals
    token0.derivedETH = ZERO_BD
    token0.tradeVolume = ZERO_BD
    token0.tradeVolumeUSD = ZERO_BD
    token0.totalLiquidity = ZERO_BD
    token0.allPairs = []
    token0.mostLiquidPairs = []
    token0.txCount = ZERO_BI
  }

  // fetch info if null
  if (token1 == null) {
    token1 = new Token(event.params.token1.toHexString())
    token1.symbol = fetchTokenSymbol(event.params.token1)
    token1.name = fetchTokenName(event.params.token1)
    let decimals = fetchTokenDecimals(event.params.token1)
    // bail if we couldn't figure out the decimals
    if (decimals === null) {
      return
    }
    token1.decimals = decimals
    token1.derivedETH = ZERO_BD
    token1.tradeVolume = ZERO_BD
    token1.tradeVolumeUSD = ZERO_BD
    token1.totalLiquidity = ZERO_BD
    token1.allPairs = []
    token1.mostLiquidPairs = []
    token1.txCount = ZERO_BI
  }

  let newAllPairsArray0 = token0.allPairs
  newAllPairsArray0.push(event.params.pair.toHexString())
  token0.allPairs = newAllPairsArray0

  let newAllPairsArray1 = token1.allPairs
  newAllPairsArray1.push(event.params.pair.toHexString())
  token1.allPairs = newAllPairsArray1

  let pair = new Pair(event.params.pair.toHexString()) as Pair
  pair.token0 = token0.id
  pair.token1 = token1.id
  pair.createdAtTimestamp = event.block.timestamp
  pair.createdAtBlockNumber = event.block.number
  pair.txCount = ZERO_BI
  pair.reserve0 = ZERO_BD
  pair.reserve1 = ZERO_BD
  pair.reserveUSD = ZERO_BD
  pair.totalSupply = ZERO_BD
  pair.volumeToken0 = ZERO_BD
  pair.volumeToken1 = ZERO_BD
  pair.volumeUSD = ZERO_BD
  pair.token0Price = ZERO_BD
  pair.token1Price = ZERO_BD

  // set weth exchange if exists
  // TODO change to mainnet WETH
  let WETHAddress = Address.fromString('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2')
  if (event.params.token0 == WETHAddress) {
    token1.wethPair = pair.id
  } else if (event.params.token1 == WETHAddress) {
    token0.wethPair = pair.id
  }

  // update factory totals
  let factoryPairs = factory.pairs
  factoryPairs.push(pair.id)
  factory.pairs = factoryPairs

  // create the tracked contract based on the template
  PairTemplate.create(event.params.pair)

  // save updated values
  token0.save()
  token1.save()
  pair.save()
  factory.save()
}
