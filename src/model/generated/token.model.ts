import {BigDecimal} from "@subsquid/big-decimal"
import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, OneToMany as OneToMany_} from "typeorm"
import * as marshal from "./marshal"
import {TokenPoolWhitelist} from "./tokenPoolWhitelist.model"
import {TokenDayData} from "./tokenDayData.model"

@Entity_()
export class Token {
    constructor(props?: Partial<Token>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Column_("text", {nullable: false})
    symbol!: string

    @Column_("text", {nullable: false})
    name!: string

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    decimals!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    totalSupply!: bigint

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    volume!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    volumeUSD!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    untrackedVolumeUSD!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    feesUSD!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    txCount!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    poolCount!: bigint

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    totalValueLocked!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    totalValueLockedUSD!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    totalValueLockedUSDUntracked!: BigDecimal

    @Column_("numeric", {transformer: marshal.bigdecimalTransformer, nullable: false})
    derivedMatic!: BigDecimal

    @OneToMany_(() => TokenPoolWhitelist, e => e.token)
    whitelistPools!: TokenPoolWhitelist[]

    @OneToMany_(() => TokenDayData, e => e.token)
    tokenDayData!: TokenDayData[]
}
