import {BigDecimal} from "@subsquid/big-decimal"
import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"
import {Pool} from "./pool.model"
import {Token} from "./token.model"
import {Tick} from "./tick.model"
import {Transaction} from "./transaction.model"

@Entity_()
export class Position {
    constructor(props?: Partial<Position>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Column_("bytea", {nullable: false})
    owner!: Uint8Array

    @Index_()
    @ManyToOne_(() => Pool, {nullable: true})
    pool!: Pool

    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    token0!: Token

    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    token1!: Token

    @Index_()
    @ManyToOne_(() => Tick, {nullable: true})
    tickLower!: Tick

    @Index_()
    @ManyToOne_(() => Tick, {nullable: true})
    tickUpper!: Tick

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    liquidity!: bigint

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    depositedToken0!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    depositedToken1!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    withdrawnToken0!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    withdrawnToken1!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    collectedToken0!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    collectedToken1!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    collectedFeesToken0!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    collectedFeesToken1!: BigDecimal

    @Index_()
    @ManyToOne_(() => Transaction, {nullable: true})
    transaction!: Transaction

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    feeGrowthInside0LastX128!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    feeGrowthInside1LastX128!: bigint

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: true})
    token0Tvl!: BigDecimal | undefined | null

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: true})
    token1Tvl!: BigDecimal | undefined | null
}
