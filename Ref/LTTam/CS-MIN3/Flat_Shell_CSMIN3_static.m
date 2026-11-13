%--------------------------------------------------------------------------
% PURPOSE
%    Plate problem use CS-MIN3
%    Analysic static for Sodelis-Lo roof shell
%--------------------------------------------------------------------------
%   Coded by Ho Huu Vinh
%   FOSAT Group – HCMC, Vietnam
%   Email: hohuuvinh90@gmail.com or hohuuvingspkt@gmail.com
%   Last modified: February 2013
%--------------------------------------------------------------------------

clear all; close all
clc
format short
global nnode nodes gcoord nel nx ny
%--------------------------------------------------------------------------
%                    khai bao du lieu bai toan
%--------------------------------------------------------------------------
emodule=4.32e8;         % elastic modulus
poisson=0.3;            % Poisson's ratio
t=0.25;                 % shell thickness
shcof=5/6;              % shear correction factor
G = emodule/(2*(1+poisson)); % module truot
%--------------------------------------------------------------------------
%                       Tinh ma tran vat lieu D
%--------------------------------------------------------------------------
% 1. la ung suat phang, 2. bien dang phang, 3. phan tich doi xung
[Dm] = material_matrix(1,emodule,poisson)*t;     % bien dang mang
[Db] = material_matrix(2,emodule,poisson)*t^3/12;% bien dang uon
[Ds] = material_shear(emodule,poisson,shcof,t);  % bien dang cat
%--------------------------------------------------------------------------
%                   roi rac phan tu va ket noi nut phan tu
%--------------------------------------------------------------------------
nx=8;                    % so doan chia theo truc x
ny=8;                    % so doan chia theo truc y
nel=2*nx*ny;             % number of elements
nnel=3;                  % number of nodes per element
ndof=6;                  % number of dofs per node
nnode=(nx+1)*(ny+1);     % total number of nodes in system
sdof=nnode*ndof;         % total system dofs
edof=nnel*ndof;          % degrees of freedom per element
num_last_nodey=ny+1;                     % number of last nodal on y axis
gcoord=coord(nnode,num_last_nodey);      % xac dinh toa do nut
num_last_ele_strip1=ny;                  % number of last element on strip 1
nodes=generate_mesh(nx,ny);
%------------------------------- Plot Mesh --------------------------------
% plot_mesh(nodes,gcoord);
%--------------------------------------------------------------------------
%                        khai bao dieu kien bien
%--------------------------------------------------------------------------
[bcdof,bcval]=bcdof_ex1(ndof,nx,ny);
%---------------------------------- force----------------------------------
ff=Cal_Load(nel/2,4,num_last_nodey,sdof);
%--------------------------------------------------------------------------
%                          tinh ma tran do cung
%--------------------------------------------------------------------------

T=T_sign;               % ma tran doi dau
[point,weight]=get_Gauss_T3(3);
al_stab = 0.1;
k = zeros(sdof,sdof);   % khai bao ma tran do cung ban dau la zeros
ke = zeros(edof,edof);
for i = 1 : nel         % vong lap cho tat ca cac phan tu
    km=zeros(edof,edof);        % element membrane matrix
    kb=zeros(edof,edof);        % element bending matrix
    ks=zeros(edof,edof);        % element shear matrix
    
    nd=nodes(i,:);
    x = gcoord(nd,1)'; y = gcoord(nd,2)'; z = gcoord(nd,3)';
    %------------------------------------------------------
    %  compute the local direction cosines and local axes
    %------------------------------------------------------
    [tr3d,xprime,yprime]=T_transform_3node(x,y,z,nnel);
    area = cal_area_polygon(xprime,yprime);
    %----------------------------------------------------
    % tinh ma tran vat lieu bien dang cat duoc hieu chinh
    %----------------------------------------------------
    [Ds]=Ds_adjust(xprime,yprime,G,shcof,t,al_stab);
    %-------------------------------------------
    % ma tran ket noi phan tu cua 3 tam giac con
    %-------------------------------------------
    [el] = sub_triangle(xprime,yprime);
    %----------------------------------------------------------------------
    %                 vong lap qua 3 phan tu tam giac con
    %----------------------------------------------------------------------
    Bs1 = zeros(2,18);
    Bs2 = zeros(2,18);
    Bs3 = zeros(2,18);
    for s_el = 1:length(el)
        xcoord = el{s_el}(1,:);     % toa do phuong x cua tam giac con
        ycoord = el{s_el}(2,:);     % toa do phuong y cua tam giac con
        % dien tich tam giac con
        Ase = cal_area_polygon(xcoord,ycoord);
        detJ = 2*Ase; % or = a*c-b*d
        [a1,a2,a3,b1,b2,b3]=cal_side(xcoord,ycoord);
        %-----------------------
        % ma tran bien dang mang
        %------------------------------------------------------------------------------
        % ma tran bien dang mang Bm
        % Bm = [dNx1   0  0 0 0 0 dNx2  0   0 0 0 0 dNx3  0   0 0 0 0 dNx4  0   0 0 0 0
        %         0  dNy1 0 0 0 0  0   dNy2 0 0 0 0  0   dNy3 0 0 0 0   0  dNy4 0 0 0 0
        %       dNy1 dNx1 0 0 0 0 dNy2 dNx2 0 0 0 0 dNy3 dNx3 0 0 0 0 dNy4 dNx4 0 0 0 0];
        %-------------------------------------------------------------------------------
        bm1 = [b1 0 0 0 0 0; 0 a1 0 0 0 0; a1 b1 0 0 0 0]./detJ; % bien dang mang tai nut 1
        bm2 = [b2 0 0 0 0 0; 0 a2 0 0 0 0; a2 b2 0 0 0 0]./detJ; % bien dang mang tai nut 2
        bm3 = [b3 0 0 0 0 0; 0 a3 0 0 0 0; a3 b3 0 0 0 0]./detJ; % bien dang mang tai nut 3
        %----------------------
        % Ma tran bien dang uon
        %-------------------------------------
        % Tinh theo bac tu do (theta)
        % Bb1 = [0 b1 0    0  b2 0   0  b3  0
        %        0 0  a1   0  0  a2  0  0  a3
        %        0 a1 b1   0  a2 b2  0  a3 b3];
        %--------------------------------------
        bb1 = [0 0 0 b1 0 0; 0 0 0 0 a1 0; 0 0 0 a1 b1 0]./detJ; % bien dang uon tai nut 1
        bb2 = [0 0 0 b2 0 0; 0 0 0 0 a2 0; 0 0 0 a2 b2 0]./detJ; % bien dang uon tai nut 2
        bb3 = [0 0 0 b3 0 0; 0 0 0 0 a3 0; 0 0 0 a3 b3 0]./detJ; % bien dang uon tai nut 3
        if s_el==1
            % ma tran bien dang tam giac con 1 (O12)
            Bm1 = [bm1./3+bm2,  bm1./3+bm3,  bm1./3].*Ase;
            Bb1 = [bb1./3+bb2,  bb1./3+bb3,  bb1./3].*Ase;
        elseif s_el==2
            % ma tran bien dang tam giac con 1 (O23)
            Bm2 = [bm1./3,  bm1./3+bm2,  bm1./3+bm3].*Ase;
            Bb2 = [bb1./3,  bb1./3+bb2,  bb1./3+bb3].*Ase;
        elseif s_el==3;
            % ma tran bien dang tam giac con 1 (O31)
            Bm3 = [bm1./3+bm3,  bm1./3,  bm1./3+bm2].*Ase;
            Bb3 = [bb1./3+bb3,  bb1./3,  bb1./3+bb2].*Ase;
        end
        %----------------------------
        % tinh ma tran bien dang cat
        %----------------------------
        for inth=1:length(weight)
            x = point(inth,1);         % sampling point in x-axis
            y = point(inth,2);
            wt = weight(inth);         % weight in x-axis
            % tinh ham dang va dao ham cua no
            [N,dNdxi,dNdeta] = shape_T3(x,y);
            % Tinh Jacobi
            [jacob] = cal_jacobi(nnel,dNdxi,dNdeta,xcoord,ycoord);
            detJacobi = det(jacob); % dinh thuc Jacobian
            invjacob = inv(jacob);  % nghich dao Jacobian
            % dao ham ham dang theo x va theo y
            [dNdx,dNdy] = dNx_dNy(nnel,dNdxi,dNdeta,invjacob);
            %----------------------
            % Ma tran bien dang cat
            %---------------------------
            % Tinh theo bac tu do (beta)
            % Bs = [dNx   dHx+N   dLx   
            %       dNy    dHy   dLy+N]
            %---------------------------
            [bs] = cal_Bs_MIN3_shell(dNdx,dNdy,N,a1,a2,a3,b1,b2,b3);
            % [bs] = Bs_MIN3(a1,a2,a3,b1,b2,b3,x,y,detJacobi);
            bs1 = bs(:,1:6);   % bien dang cat tai nut 1
            bs2 = bs(:,7:12);  % bien dang cat tai nut 2
            bs3 = bs(:,13:18); % bien dang cat tai nut 3
            if s_el==1
                % ma tran bien dang tam giac con 1 (O12)
                Bs1 = Bs1 + [bs1./3+bs2,  bs1./3+bs3,  bs1./3]*wt*detJacobi;
            elseif s_el==2
                % ma tran bien dang tam giac con 1 (O23)
                Bs2 = Bs2 + [bs1./3,  bs1./3+bs2,  bs1./3+bs3]*wt*detJacobi;
            elseif s_el==3;
                % ma tran bien dang tam giac con 1 (O31)
                Bs3 = Bs3 + [bs1./3+bs3,  bs1./3,  bs1./3+bs2]*wt*detJacobi;
            end
        end  %  ket thuc vong lap Gauss
    end      %  ket thuc vong lap qua 3 tam giac con
    %------------------------------------------
    % ma tran bien dang mang cho phan tu thu i
    %------------------------------------------
    Bm = (Bm1+Bm2+Bm2)./area;
    km = Bm'*Dm*Bm*area;
    %------------------------------------------
    % ma tran bien dang uon cho phan tu thu i
    %------------------------------------------
    Bb = (Bb1+Bb2+Bb3)./area;
    Bb = Bb*T;
    kb = Bb'*Db*Bb*area;
    %------------------------------------------
    % ma tran bien dang cat cho phan tu thu i
    %------------------------------------------
    Bs = (Bs1+Bs2+Bs3)./area;
    Bs = Bs*T;
    ks = Bs'*Ds*Bs*area;
    %------------------------
    % ma tran do cung phan tu
    %------------------------
    ke = km + kb + ks;
    ke = tr3d'*ke*tr3d;
    %--------------------------------------------------------------
    % lap ghep ma tran do cung phan tu vao ma tran do cung tong the
    %--------------------------------------------------------------
    index = index_assemble(nd,nnel,ndof);
    k(index,index) = k(index,index) + ke;
end % main element
%--------------------------------------------------------------------------
%                     dieu kien bien va giai tim chuyen vi
%--------------------------------------------------------------------------
%-----------------------check the singular drilling dof -------------------
for i=1:sdof
    if(abs(k(i,i)) < 1e-5)
        sum=0.0;
        for j=1:sdof
            sum=sum+abs(k(i,j));
        end
        if (sum < 1e-5)
            k(i,i)=1;
        end
    end
end
%--------------------------------------------------------------------------



[kk,ff] = apply_condition_load(k,ff,bcdof,bcval);
U = inv(kk)*ff;
disp('================================================')
disp('exact deflection at A = 0.3024');
wA = -U(nnode*6-3)
energy_strain=0.5*U'*kk*U

% % ve chuyen vi
% figure('color',[1 1 1])
% trisurf(nodes,gcoord(:,1),gcoord(:,2),W*1e3);
% shading interp
% view(0,90)
% % return



