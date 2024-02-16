import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import {Token} from "./token.model"
import {Pool} from "./pool.model"

@Entity_()
export class TokenPoolWhitelist {
    constructor(props?: Partial<TokenPoolWhitelist>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => Token, {nullable: true})
    token!: Token

    @Index_()
    @ManyToOne_(() => Pool, {nullable: true})
    pool!: Pool
}
