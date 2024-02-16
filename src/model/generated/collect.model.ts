import {BigDecimal} from "@subsquid/big-decimal"
import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"
import {Transaction} from "./transaction.model"
import {Pool} from "./pool.model"

@Entity_()
export class Collect {
    constructor(props?: Partial<Collect>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => Transaction, {nullable: true})
    transaction!: Transaction

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    timestamp!: bigint

    @Index_()
    @ManyToOne_(() => Pool, {nullable: true})
    pool!: Pool

    @Column_("bytea", {nullable: true})
    owner!: Uint8Array | undefined | null

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    amount0!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    amount1!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: true})
    amountUSD!: BigDecimal | undefined | null

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    tickLower!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    tickUpper!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: true})
    logIndex!: bigint | undefined | null
}
