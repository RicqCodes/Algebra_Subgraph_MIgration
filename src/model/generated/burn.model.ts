import {BigDecimal} from "@subsquid/big-decimal"
import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"
import {Transaction} from "./transaction.model"
import {Pool} from "./pool.model"
import {Token} from "./token.model"

@Entity_()
export class Burn {
    constructor(props?: Partial<Burn>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => Transaction, {nullable: true})
    transaction!: Transaction

    @Index_()
    @ManyToOne_(() => Pool, {nullable: true})
    pool!: Pool

    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    token0!: Token

    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    token1!: Token

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    timestamp!: bigint

    @Column_("bytea", {nullable: true})
    owner!: Uint8Array | undefined | null

    @Column_("bytea", {nullable: false})
    origin!: Uint8Array

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    amount!: bigint

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
