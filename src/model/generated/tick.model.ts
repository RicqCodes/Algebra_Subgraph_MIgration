import {BigDecimal} from "@subsquid/big-decimal"
import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"
import {Pool} from "./pool.model"

@Entity_()
export class Tick {
    constructor(props?: Partial<Tick>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Column_("text", {nullable: true})
    poolAddress!: string | undefined | null

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    tickIdx!: bigint

    @Index_()
    @ManyToOne_(() => Pool, {nullable: true})
    pool!: Pool

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    liquidityGross!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    liquidityNet!: bigint

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    price0!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    price1!: BigDecimal

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
    collectedFeesToken0!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    collectedFeesToken1!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    collectedFeesUSD!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    createdAtTimestamp!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    createdAtBlockNumber!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    liquidityProviderCount!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    feeGrowthOutside0X128!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    feeGrowthOutside1X128!: bigint
}
