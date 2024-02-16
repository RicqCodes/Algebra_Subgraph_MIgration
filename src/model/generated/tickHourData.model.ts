import {BigDecimal} from "@subsquid/big-decimal"
import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"
import {Pool} from "./pool.model"
import {Tick} from "./tick.model"

@Entity_()
export class TickHourData {
    constructor(props?: Partial<TickHourData>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Column_("int4", {nullable: false})
    periodStartUnix!: number

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
}
