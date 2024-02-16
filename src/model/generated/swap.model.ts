import {BigDecimal} from "@subsquid/big-decimal"
import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"
import {Transaction} from "./transaction.model"
import {Pool} from "./pool.model"
import {Token} from "./token.model"

@Entity_()
export class Swap {
    constructor(props?: Partial<Swap>) {
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

    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    token0!: Token

    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    token1!: Token

    @Column_("bytea", {nullable: false})
    sender!: Uint8Array

    @Column_("bytea", {nullable: false})
    recipient!: Uint8Array

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    liquidity!: bigint

    @Column_("bytea", {nullable: false})
    origin!: Uint8Array

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    amount0!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    amount1!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    amountUSD!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    price!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    tick!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: true})
    logIndex!: bigint | undefined | null
}
