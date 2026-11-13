function [Bb]=Bb_Bathe(nnel,dNdx,dNdy)

%--------------------------------------------------------------------------
%  Purpose:
%     determine the kinematic matrix expression relating bending curvatures
%     to rotations and displacements for shear deformable plate bending
%
%  Synopsis:
%     [Bb]=fekinepb(nnel,dhdx,dhdy)
%
%  Variable Description:
%     nnel - number of nodes per element
%     dhdx - derivatives of shape functions with respect to x
%     dhdy - derivatives of shape functions with respect to y
%    dof : (w,wx,wy)
%--------------------------------------------------------------------------
% B = [0  dNdx(1)    0     0  dNdx(2)   0      0  dNdx(3)    0      0  dNdx(4)   0 ;
%       0    0     dNdy(1)  0    0     dNdy(2)  0    0      dNdy(3)  0    0     dNdy(4);
%       0  dNdy(1) dNdx(1)  0  dNdy(2) dNdx(2)  0  dNdy(3)  dNdx(3)  0  dNdy(4) dNdx(4)]
for i=1:nnel
 i1=(i-1)*3+1;
 i2=i1+1;
 i3=i2+1;
 Bb(1,i1)=0;
 Bb(1,i2)=0;
 Bb(1,i3)=dNdx(i);

 Bb(2,i1)=0;
 Bb(2,i2)=-dNdy(i);
 Bb(2,i3)=0;

 Bb(3,i1)=0;
 Bb(3,i2)=-dNdx(i);
 Bb(3,i3)=dNdy(i);
end

%  for i=1:nnel
%  i1=(i-1)*3+1;
%  i2=i1+1;
%  i3=i2+1;
%  Bb(1,i1)=dhdx(i);
%  Bb(2,i2)=dhdy(i);
%  Bb(3,i1)=dhdy(i);
%  Bb(3,i2)=dhdx(i);
%  Bb(3,i3)=0;
%  end
