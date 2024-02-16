import {BigDecimal} from "@subsquid/big-decimal"
import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"
import {Pool} from "./pool.model"
import {Position} from "./position.model"
import {Transaction} from "./transaction.model"

@Entity_()
export class PositionSnapshot {
    constructor(props?: Partial<PositionSnapshot>) {
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
    @ManyToOne_(() => Position, {nullable: true})
    position!: Position

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    blockNumber!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    timestamp!: bigint

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
}
