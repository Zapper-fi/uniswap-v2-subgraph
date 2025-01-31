/* eslint-disable prefer-const */
import { BigInt, BigDecimal, EthereumEvent } from '@graphprotocol/graph-ts'
import { Pair, Bundle, Token, UniswapFactory, UniswapDayData, PairDayData, TokenDayData } from '../types/schema'
import { ONE_BI, ZERO_BD, ZERO_BI, FACTORY_ADDRESS } from './helpers'

// max number of entities to store
const maxTokenDayDatas = 10
const maxPairDayDatas = 10

function updateStoredPairs(tokenDayData: TokenDayData, exchangeDayID: string): void {
  let pairDayData = PairDayData.load(exchangeDayID.toString())
  let newList = tokenDayData.mostLiquidPairs
  let alreadyInList = false
  // check if exchange is already in list, make sure to compare on exchange
  for (let i = 0; i < newList.length; i++) {
    let currentPairData = PairDayData.load(newList[i])
    if (currentPairData.pairAddress.toHexString() == pairDayData.pairAddress.toHexString()) {
      alreadyInList = true
      newList[i] = pairDayData.id // reset to new day data
    }
  }
  // base case max number
  let minTokenLiquidity = new BigDecimal(BigInt.fromI32(I32.MAX_VALUE))
  let minIndex = 0
  if (newList.length < tokenDayData.maxStored && !alreadyInList) {
    newList.push(pairDayData.id)
  } else if (!alreadyInList) {
    // loop through stored list and find min token liquidity
    for (let i = 0; i < newList.length; i++) {
      let currentPairs = tokenDayData.mostLiquidPairs as Array<string>
      let id = currentPairs[i]
      let currentPairDayData = PairDayData.load(id.toString())
      let globalToken = tokenDayData.token
      let localToken0 = currentPairDayData.token0
      // if our token of interest is token0, compare against that
      if (globalToken == localToken0) {
        if (currentPairDayData.reserve0 < minTokenLiquidity) {
          minTokenLiquidity = currentPairDayData.reserve0
          minIndex = i
        }
      }
      // our token of interest must be token 1
      else {
        if (currentPairDayData.reserve1 < minTokenLiquidity) {
          minTokenLiquidity = currentPairDayData.reserve1
          minIndex = i
        }
      }
    }
    // if current token has more liquidity than min, replace it
    if (tokenDayData.totalLiquidityToken > minTokenLiquidity) {
      newList[minIndex] = pairDayData.id
    }
  }
  tokenDayData.mostLiquidPairs = newList
  let token = Token.load(tokenDayData.token)
  token.mostLiquidPairs = newList
  token.save()
  tokenDayData.save()
}

/**
 * Loop through stored token datas and find minimum liquidity in ETH.
 * If new token is higher than min, replace min list at min index.
 */
function updateStoredTokens(tokenDayData: TokenDayData, dayID: i32): void {
  let uniswap = UniswapFactory.load(FACTORY_ADDRESS)
  let uniswapDayData = UniswapDayData.load(dayID.toString())
  let newList = uniswapDayData.mostLiquidTokens
  let alreadyInList = false
  // check if token is already in the list
  for (let i = 0; i < newList.length; i++) {
    let currentDayData = TokenDayData.load(newList[i].toString())
    if (currentDayData.token.toString() == tokenDayData.token.toString()) {
      alreadyInList = true
      newList[i] = tokenDayData.id
    }
  }
  let minIndex = 0
  if (newList.length < uniswapDayData.maxStored && !alreadyInList) {
    newList.push(tokenDayData.id)
  } else if (!alreadyInList) {
    let localMinLiquidity = new BigDecimal(BigInt.fromI32(I32.MAX_VALUE))
    // loop through stored list and find min liquidity
    for (let i = 0; i < newList.length; i++) {
      let currentDayData = TokenDayData.load(newList[i].toString())
      if (currentDayData.totalLiquidityETH < localMinLiquidity) {
        localMinLiquidity = currentDayData.totalLiquidityETH
        minIndex = i
      }
    }
    // if current token has more liquidity than min, replace it
    if (tokenDayData.totalLiquidityETH > localMinLiquidity) {
      newList[minIndex] = tokenDayData.id
    }
  }
  uniswapDayData.mostLiquidTokens = newList
  uniswap.mostLiquidTokens = newList
  uniswap.save()
  uniswapDayData.save()
}

export function updateUniswapDayData(event: EthereumEvent): void {
  let uniswap = UniswapFactory.load(FACTORY_ADDRESS)
  let timestamp = event.block.timestamp.toI32()
  let dayID = timestamp / 86400
  let dayStartTimestamp = dayID * 86400
  let uniswapDayData = UniswapDayData.load(dayID.toString())
  if (uniswapDayData == null) {
    let uniswapDayData = new UniswapDayData(dayID.toString())
    uniswapDayData.date = dayStartTimestamp
    uniswapDayData.dailyVolumeUSD = ZERO_BD
    uniswapDayData.dailyVolumeETH = ZERO_BD
    uniswapDayData.totalVolumeUSD = ZERO_BD
    uniswapDayData.totalVolumeETH = ZERO_BD
    uniswapDayData.totalLiquidityUSD = ZERO_BD
    uniswapDayData.totalLiquidityETH = ZERO_BD
    uniswapDayData.maxStored = maxTokenDayDatas
    uniswapDayData.mostLiquidTokens = uniswap.mostLiquidTokens
    uniswapDayData.txCount = ZERO_BI
    uniswapDayData.save()
  }
  uniswapDayData = UniswapDayData.load(dayID.toString())
  uniswapDayData.totalLiquidityUSD = uniswap.totalLiquidityUSD
  uniswapDayData.totalLiquidityETH = uniswap.totalLiquidityETH
  uniswapDayData.txCount = uniswap.txCount
  uniswapDayData.save()
}

export function updatePairDayData(event: EthereumEvent): void {
  let timestamp = event.block.timestamp.toI32()
  let dayID = timestamp / 86400
  let dayStartTimestamp = dayID * 86400
  let dayPairID = event.address
    .toHexString()
    .concat('-')
    .concat(BigInt.fromI32(dayID).toString())
  let pair = Pair.load(event.address.toHexString())
  let pairDayData = PairDayData.load(dayPairID)
  if (pairDayData == null) {
    let pairDayData = new PairDayData(dayPairID)
    let pair = Pair.load(event.address.toHexString())
    pairDayData.date = dayStartTimestamp
    pairDayData.token0 = pair.token0
    pairDayData.token1 = pair.token1
    pairDayData.totalSupply = pair.totalSupply
    pairDayData.pairAddress = event.address
    pairDayData.reserve0 = ZERO_BD
    pairDayData.reserve1 = ZERO_BD
    pairDayData.reserveUSD = ZERO_BD
    pairDayData.dailyVolumeToken0 = ZERO_BD
    pairDayData.dailyVolumeToken1 = ZERO_BD
    pairDayData.dailyVolumeUSD = ZERO_BD
    pairDayData.dailyTxns = ZERO_BI
    pairDayData.save()
  }
  pairDayData = PairDayData.load(dayPairID)
  pairDayData.reserve0 = pair.reserve0
  pairDayData.reserve1 = pair.reserve1
  pairDayData.reserveUSD = pair.reserveUSD
  pairDayData.dailyTxns = pairDayData.dailyTxns.plus(ONE_BI)
  pairDayData.save()
}

export function updateTokenDayData(token: Token, event: EthereumEvent): void {
  let bundle = Bundle.load('1')
  let timestamp = event.block.timestamp.toI32()
  let dayID = timestamp / 86400
  let dayStartTimestamp = dayID * 86400
  let tokenDayID = token.id
    .toString()
    .concat('-')
    .concat(BigInt.fromI32(dayID).toString())
  let dayPairID = event.address
    .toHexString()
    .concat('-')
    .concat(BigInt.fromI32(dayID).toString())

  let tokenDayData = TokenDayData.load(tokenDayID)
  if (tokenDayData == null) {
    let tokenDayData = new TokenDayData(tokenDayID)
    tokenDayData.date = dayStartTimestamp
    tokenDayData.token = token.id
    tokenDayData.priceUSD = token.derivedETH.times(bundle.ethPrice)
    tokenDayData.dailyVolumeToken = ZERO_BD
    tokenDayData.dailyVolumeETH = ZERO_BD
    tokenDayData.dailyVolumeUSD = ZERO_BD
    tokenDayData.dailyTxns = ZERO_BI
    tokenDayData.totalLiquidityToken = ZERO_BD
    tokenDayData.totalLiquidityETH = ZERO_BD
    tokenDayData.totalLiquidityUSD = ZERO_BD
    tokenDayData.maxStored = maxPairDayDatas
    tokenDayData.mostLiquidPairs = token.mostLiquidPairs
    tokenDayData.save()
  }
  tokenDayData = TokenDayData.load(tokenDayID)
  tokenDayData.priceUSD = token.derivedETH.times(bundle.ethPrice)
  tokenDayData.totalLiquidityToken = token.totalLiquidity
  tokenDayData.totalLiquidityETH = token.totalLiquidity.times(token.derivedETH as BigDecimal)
  tokenDayData.totalLiquidityUSD = tokenDayData.totalLiquidityETH.times(bundle.ethPrice)
  tokenDayData.dailyTxns = tokenDayData.dailyTxns.plus(ONE_BI)
  tokenDayData.save()
  updateStoredTokens(tokenDayData as TokenDayData, dayID)
  updateStoredPairs(tokenDayData as TokenDayData, dayPairID)
}
