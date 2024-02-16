import {BigDecimal} from "@subsquid/big-decimal"
import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, OneToMany as OneToMany_} from "typeorm"
import * as marshal from "./marshal"
import {Token} from "./token.model"
import {PoolHourData} from "./poolHourData.model"
import {PoolDayData} from "./poolDayData.model"
import {Mint} from "./mint.model"
import {Burn} from "./burn.model"
import {Swap} from "./swap.model"
import {Collect} from "./collect.model"
import {Tick} from "./tick.model"

@Entity_()
export class Pool {
    constructor(props?: Partial<Pool>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    createdAtTimestamp!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    createdAtBlockNumber!: bigint

    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    token0!: Token

    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    token1!: Token

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    fee!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    communityFee0!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    communityFee1!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    liquidity!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    sqrtPrice!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    feeGrowthGlobal0X128!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    feeGrowthGlobal1X128!: bigint

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    token0Price!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    token1Price!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    tick!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    observationIndex!: bigint

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    volumeToken0!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    volumeToken1!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    volumeUSD!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    untrackedVolumeUSD!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    feesUSD!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    untrackedFeesUSD!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    txCount!: bigint

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    collectedFeesToken0!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    collectedFeesToken1!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    collectedFeesUSD!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    totalValueLockedToken0!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    totalValueLockedToken1!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    feesToken0!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    feesToken1!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    totalValueLockedMatic!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    totalValueLockedUSD!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    totalValueLockedUSDUntracked!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    liquidityProviderCount!: bigint

    @OneToMany_(() => PoolHourData, e => e.pool)
    poolHourData!: PoolHourData[]

    @OneToMany_(() => PoolDayData, e => e.pool)
    poolDayData!: PoolDayData[]

    @OneToMany_(() => Mint, e => e.pool)
    mints!: Mint[]

    @OneToMany_(() => Burn, e => e.pool)
    burns!: Burn[]

    @OneToMany_(() => Swap, e => e.pool)
    swaps!: Swap[]

    @OneToMany_(() => Collect, e => e.pool)
    collects!: Collect[]

    @OneToMany_(() => Tick, e => e.pool)
    ticks!: Tick[]
}
