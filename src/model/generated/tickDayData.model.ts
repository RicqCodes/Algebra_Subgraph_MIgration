import {BigDecimal} from "@subsquid/big-decimal"
import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"
import {Pool} from "./pool.model"
import {Tick} from "./tick.model"

@Entity_()
export class TickDayData {
    constructor(props?: Partial<TickDayData>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    date!: bigint

    @Index_()
    @ManyToOne_(() => Pool, {nullable: true})
    pool!: Pool

    @Index_()
    @ManyToOne_(() => Tick, {nullable: true})
    tick!: Tick

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    liquidityGross!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    liquidityNet!: bigint

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    volumeToken0!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    volumeToken1!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    volumeUSD!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    feesUSD!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    feeGrowthOutside0X128!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    feeGrowthOutside1X128!: bigint
}
