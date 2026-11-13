function [Bm,Bb,Bs]=B_MIN3_Shell(nnel,x,y,N,dNdxi,dNdeta,J)
% Tinh ma tran bien dang cho phan tu Shell MIN3
% Cac he so
a=[ x(3)-x(2);
    x(1)-x(3);
    x(2)-x(1)];
b=[ y(2)-y(3);
    y(3)-y(1);
    y(1)-y(2)];
% Jacobian
invJ=inv(J);
% Dao ham cua ham dang
for i=1:nnel
    dNdx(i)=invJ(1,1)*dNdxi(i)+invJ(1,2)*dNdeta(i);
    dNdy(i)=invJ(2,1)*dNdxi(i)+invJ(2,2)*dNdeta(i);
end
Bm= zeros(3,6*nnel);
Bb= zeros(3,6*nnel);
Bs= zeros(2,6*nnel);

% Ma tran bien dang mang (Membrane)
Bm(1,1:6:6*nnel)= dNdx;
Bm(2,2:6:6*nnel)= dNdy;
Bm(3,1:6:6*nnel)= dNdy;
Bm(3,2:6:6*nnel)= dNdx;

% Ma tran bien dang uon (Bending)
Bb(1,5:6:6*nnel)= -dNdx;
Bb(2,4:6:6*nnel)= dNdy;
Bb(3,4:6:6*nnel)= -dNdx;
Bb(3,5:6:6*nnel)= dNdy;

% Dao ham cua vecto ham dang
dHdx=1/2*[a(2)*(dNdx(3)*N(1)+N(3)*dNdx(1))-a(3)*(dNdx(1)*N(2)+N(1)*dNdx(2))
          a(3)*(dNdx(1)*N(2)+N(1)*dNdx(2))-a(1)*(dNdx(2)*N(3)+N(2)*dNdx(3))
          a(1)*(dNdx(2)*N(3)+N(2)*dNdx(3))-a(2)*(dNdx(3)*N(1)+N(3)*dNdx(1))];
dHdy=1/2*[a(2)*(dNdy(3)*N(1)+N(3)*dNdy(1))-a(3)*(dNdy(1)*N(2)+N(1)*dNdy(2))
          a(3)*(dNdy(1)*N(2)+N(1)*dNdy(2))-a(1)*(dNdy(2)*N(3)+N(2)*dNdy(3))
          a(1)*(dNdy(2)*N(3)+N(2)*dNdy(3))-a(2)*(dNdy(3)*N(1)+N(3)*dNdy(1))];
dLdx=1/2*[b(3)*(dNdx(1)*N(2)+N(1)*dNdx(2))-b(2)*(dNdx(3)*N(1)+N(3)*dNdx(1))
          b(1)*(dNdx(2)*N(3)+N(2)*dNdx(3))-b(3)*(dNdx(1)*N(2)+N(1)*dNdx(2))
          b(2)*(dNdx(3)*N(1)+N(3)*dNdx(1))-b(1)*(dNdx(2)*N(3)+N(2)*dNdx(3))];
dLdy=1/2*[b(3)*(dNdy(1)*N(2)+N(1)*dNdy(2))-b(2)*(dNdy(3)*N(1)+N(3)*dNdy(1))
          b(1)*(dNdy(2)*N(3)+N(2)*dNdy(3))-b(3)*(dNdy(1)*N(2)+N(1)*dNdy(2))
          b(2)*(dNdy(3)*N(1)+N(3)*dNdy(1))-b(1)*(dNdy(2)*N(3)+N(2)*dNdy(3))];

% Ma tran bien dang cat (Shearing)
Bs(1,3:6:6*nnel)= dNdx;
Bs(2,3:6:6*nnel)= dNdy;
Bs(1,4:6:6*nnel)= -dLdx';
Bs(2,4:6:6*nnel)= -(dLdy'+N);
Bs(1,5:6:6*nnel)= dHdx'+N;
Bs(2,5:6:6*nnel)= dHdy';

end